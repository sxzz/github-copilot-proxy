import {
  eventHandler,
  getQuery,
  getRequestHeader,
  getRequestHeaders,
  getRequestWebStream,
  sendWebResponse,
  setResponseStatus,
} from 'h3'
import { useRuntimeConfig } from 'nitropack/runtime'

export default eventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)

  let apiKey = getQuery(event).apiKey
  if (!apiKey) {
    apiKey = getRequestHeader(event, 'Authorization')?.replace(/^Bearer /, '')
  }
  if (!apiKey || apiKey !== runtimeConfig.apiKey) {
    setResponseStatus(event, 401)
    return {
      status: 401,
      message: 'API key is invalid',
    }
  }

  const githubToken = runtimeConfig.githubToken
  if (!githubToken) {
    setResponseStatus(event, 401)
    return {
      status: 401,
      message: 'NITRO_GITHUB_TOKEN is missing',
    }
  }
  const copilotToken = await getCopilotToken(githubToken)

  const body = getRequestWebStream(event)
  const headers: Record<string, string | undefined> = {
    ...getRequestHeaders(event),
    host: 'api.githubcopilot.com',
    cookie: undefined,
    'x-forwarded-for': undefined,
    'x-forwarded-port': undefined,
    'x-forwarded-proto': undefined,
    authorization: `Bearer ${copilotToken}`,
    'editor-version': 'Neovim/0.9.0',
    'editor-plugin-version': 'CopilotChat.nvim/*',
    'copilot-integration-id': 'vscode-chat',
    'user-agent': 'CopilotChat.nvim',
    accept: 'application/json',
  }

  const response = await fetch(`https://api.githubcopilot.com${event.path}`, {
    method: event.method,
    headers: headers as any,
    body,
    // @ts-expect-error missing field
    duplex: 'half',
  })

  return sendWebResponse(event, response)
})

async function getCopilotToken(githubToken: string) {
  const response = await $fetch<{ token: string }>(
    'https://api.github.com/copilot_internal/v2/token',
    {
      headers: {
        'User-Agent': 'CopilotChat.nvim',
        Accept: 'application/json',
        Authorization: `Token ${githubToken}`,
      },
    },
  )
  return response.token
}
