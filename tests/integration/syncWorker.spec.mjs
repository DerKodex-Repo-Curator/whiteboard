/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/database/db.ts', () => ({
	db: {
		get: vi.fn(async () => undefined),
		put: vi.fn(async () => 1),
	},
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function deferredResponse() {
	let resolve
	const promise = new Promise((resolvePromise) => {
		resolve = resolvePromise
	})
	return { promise, resolve }
}

const ok = { ok: true, status: 200, json: async () => ({ status: 'success' }) }

describe('sync worker server saves', () => {
	let send
	let worker
	let responses

	beforeEach(async () => {
		vi.resetModules()
		responses = []
		vi.stubGlobal('fetch', vi.fn(() => {
			const response = deferredResponse()
			responses.push(response)
			return response.promise
		}))
		worker = {
			addEventListener: vi.fn(),
			postMessage: vi.fn(),
			close: vi.fn(),
			performance: globalThis.performance,
		}
		vi.stubGlobal('self', worker)
		await import('../../src/workers/syncWorker.ts')
		const listener = worker.addEventListener.mock.calls[0][1]
		send = (data) => listener({ data })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	const save = (sceneKey) => send({
		type: 'SYNC_TO_SERVER',
		fileId: 1,
		url: '/board',
		jwt: 'jwt',
		elements: [{ id: sceneKey }],
		files: {},
		sceneKey,
	})

	const sentTypes = () => worker.postMessage.mock.calls.map(([message]) => message.type)

	it('sends one save at a time and only the newest waiting scene', async () => {
		save('k1')
		await flush()
		save('k2')
		save('k3')
		await flush()
		expect(fetch).toHaveBeenCalledTimes(1)

		responses[0].resolve(ok)
		await flush()

		expect(fetch).toHaveBeenCalledTimes(2)
		expect(JSON.parse(fetch.mock.calls[1][1].body).data.elements).toEqual([{ id: 'k3' }])
	})

	it('skips a scene that was already saved', async () => {
		save('k1')
		await flush()
		responses[0].resolve(ok)
		await flush()
		save('k1')
		await flush()

		expect(fetch).toHaveBeenCalledTimes(1)
		expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'SERVER_SYNC_COMPLETE', sceneKey: 'k1' }))
	})

	it('reports a 409 as an error and retries the scene', async () => {
		save('k1')
		await flush()
		responses[0].resolve({ ok: false, status: 409, text: async () => '{"status":"conflict"}' })
		await flush()

		expect(sentTypes()).toEqual(['SERVER_SYNC_ERROR'])

		save('k1')
		await flush()
		expect(fetch).toHaveBeenCalledTimes(2)
	})

	it('closes after the running save finished', async () => {
		save('k1')
		await flush()
		send({ type: 'CLOSE' })
		await flush()
		expect(worker.close).not.toHaveBeenCalled()

		responses[0].resolve(ok)
		await flush()
		expect(worker.close).toHaveBeenCalledOnce()
	})
})
