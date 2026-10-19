/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSyncStore } from '../../src/stores/useSyncStore.ts'

describe('sync store', () => {
	beforeEach(() => {
		vi.stubGlobal('Worker', vi.fn(function() {
			return { postMessage: vi.fn(), terminate: vi.fn() }
		}))
		useSyncStore.setState({ worker: null, isWorkerReady: false, savedSceneKey: null })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('remembers the scene the current worker saved', () => {
		const worker = useSyncStore.getState().initializeWorker()

		worker.onmessage({ data: { type: 'SERVER_SYNC_COMPLETE', sceneKey: 'k1' } })

		expect(useSyncStore.getState().savedSceneKey).toBe('k1')
	})

	it('lets a closed worker finish its saves without overriding the next board', () => {
		const worker = useSyncStore.getState().initializeWorker()

		useSyncStore.getState().terminateWorker()
		worker.onmessage({ data: { type: 'SERVER_SYNC_COMPLETE', sceneKey: 'k1' } })

		expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'CLOSE' })
		expect(worker.terminate).not.toHaveBeenCalled()
		expect(useSyncStore.getState().savedSceneKey).toBeNull()
	})
})
