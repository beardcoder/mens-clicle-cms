// Entry point: `cms` starts the server, `cms --health` probes it (Docker HEALTHCHECK),
// `cms restore <backup.tar.gz>` restores database + uploads while the server is stopped.
const [command, arg] = process.argv.slice(2)
const port = Number(process.env.PORT ?? 3000)

if (command === '--health') {
	const ok = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) })
		.then((r) => r.ok)
		.catch(() => false)
	process.exit(ok ? 0 : 1)
}

if (command === 'restore') {
	if (!arg) {
		console.error('Aufruf: cms restore <backup.tar.gz>')
		process.exit(1)
	}
	const { restoreBackup } = await import('./backup')
	console.log(`✓ ${await restoreBackup(arg)} Dateien wiederhergestellt`)
	process.exit(0)
}

const { app } = await import('./app')
const { db } = await import('./db')
if (process.env.SEED !== 'false') (await import('./seed')).seed()

app.listen({ port, hostname: process.env.HOST ?? '0.0.0.0' }, (server) => {
	console.log(`🌿 CMS läuft auf ${server.url}  ·  Admin: ${server.url}admin`)
})

// Graceful shutdown (docker stop / Coolify redeploy): finish requests, checkpoint the WAL
for (const signal of ['SIGTERM', 'SIGINT'] as const)
	process.once(signal, async () => {
		await app.stop()
		db.close()
		process.exit(0)
	})

export {}
