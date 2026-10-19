/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ExcalidrawElement } from '@nextcloud/excalidraw/dist/types/excalidraw/element/types'
import type { BinaryFiles } from '@nextcloud/excalidraw/dist/types/excalidraw/types'

// Browsers reject keepalive requests above 64 KiB
const KEEPALIVE_BODY_LIMIT = 64 * 1024

export async function saveSceneOnUnload(url: string, jwt: string, elements: readonly ExcalidrawElement[], files: BinaryFiles): Promise<boolean> {
	const headers = {
		'Content-Type': 'application/json',
		'X-Requested-With': 'XMLHttpRequest',
		Authorization: `Bearer ${jwt}`,
	}
	const body = new Blob([JSON.stringify({ data: { elements, files } })])

	if (body.size <= KEEPALIVE_BODY_LIMIT) {
		const response = await fetch(url, { method: 'PUT', headers, body, keepalive: true })
		return response.ok
	}

	// Too large for keepalive: only a synchronous request can finish before the page is gone
	const xhr = new XMLHttpRequest()
	xhr.open('PUT', url, false)
	for (const [name, value] of Object.entries(headers)) {
		xhr.setRequestHeader(name, value)
	}
	xhr.send(body)
	return xhr.status >= 200 && xhr.status < 300
}
