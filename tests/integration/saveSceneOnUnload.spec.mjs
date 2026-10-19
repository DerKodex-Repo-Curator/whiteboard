/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveSceneOnUnload } from '../../src/utils/saveSceneOnUnload.ts'

const headers = {
	'Content-Type': 'application/json',
	'X-Requested-With': 'XMLHttpRequest',
	Authorization: 'Bearer jwt',
}

function stubXhr(status) {
	const xhr = { open: vi.fn(), setRequestHeader: vi.fn(), send: vi.fn(), status }
	vi.stubGlobal('XMLHttpRequest', vi.fn(function() {
		return xhr
	}))
	return xhr
}

describe('saveSceneOnUnload', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('sends a small scene with a keepalive request', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true })
		vi.stubGlobal('fetch', fetchMock)
		const xhr = stubXhr(200)

		await expect(saveSceneOnUnload('/board', 'jwt', [{ id: 'A' }], {})).resolves.toBe(true)

		expect(fetchMock).toHaveBeenCalledWith('/board', expect.objectContaining({ method: 'PUT', headers, keepalive: true }))
		const body = fetchMock.mock.calls[0][1].body
		expect(JSON.parse(await body.text())).toEqual({ data: { elements: [{ id: 'A' }], files: {} } })
		expect(xhr.send).not.toHaveBeenCalled()
	})

	it('reports a failed keepalive request as not saved', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409 }))

		await expect(saveSceneOnUnload('/board', 'jwt', [], {})).resolves.toBe(false)
	})

	it('sends a scene above the keepalive limit synchronously', async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		const xhr = stubXhr(409)
		const files = { image: { id: 'image', dataURL: 'x'.repeat(64 * 1024) } }

		await expect(saveSceneOnUnload('/board', 'jwt', [], files)).resolves.toBe(false)

		expect(fetchMock).not.toHaveBeenCalled()
		expect(xhr.open).toHaveBeenCalledWith('PUT', '/board', false)
		expect(Object.fromEntries(xhr.setRequestHeader.mock.calls)).toEqual(headers)
		expect(xhr.send).toHaveBeenCalledOnce()
	})
})
