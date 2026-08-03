// Container healthcheck. Uses Node's built-in fetch rather than wget, since
// Alpine ships BusyBox wget whose --spider behaviour varies between versions,
// and hits 127.0.0.1 explicitly because "localhost" can resolve to ::1 inside
// the container while the server binds IPv4.
const port = process.env.PORT ?? 3000

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health`)
  process.exit(res.ok ? 0 : 1)
} catch {
  process.exit(1)
}
