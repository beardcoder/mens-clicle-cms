import { app } from './app'
import { seed } from './seed'

if (process.env.SEED !== 'false') seed()

app.listen({ port: Number(process.env.PORT ?? 3000), hostname: process.env.HOST ?? '0.0.0.0' }, (server) => {
	console.log(`🌿 CMS läuft auf ${server.url}  ·  Admin: ${server.url}admin`)
})
