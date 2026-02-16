import type { Context } from 'https://edge.netlify.com'

export default async function handler(request: Request, context: Context) {
  const credentials = Deno.env.get('BASIC_AUTH_CREDENTIALS')

  // No credentials configured → skip auth entirely
  if (!credentials) {
    return context.next()
  }

  const authorization = request.headers.get('authorization')

  if (!authorization || !authorization.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="Restricted"' },
    })
  }

  try {
    const decoded = atob(authorization.slice(6))
    const [username, ...rest] = decoded.split(':')
    const password = rest.join(':') // passwords may contain colons

    const allowed = credentials.split(' ').map((pair) => {
      const [u, ...p] = pair.split(':')
      return { username: u, password: p.join(':') }
    })

    const match = allowed.some(
      (cred) => cred.username === username && cred.password === password,
    )

    if (!match) {
      return new Response('Invalid credentials', {
        status: 401,
        headers: { 'www-authenticate': 'Basic realm="Restricted"' },
      })
    }

    // Auth passed — forward the request and inject the username into the response
    const response = await context.next()
    response.headers.set('x-auth-user', username)
    return response
  } catch {
    return new Response('Bad Gateway', { status: 502 })
  }
}
