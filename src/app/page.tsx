export default function Home() {
  return (
    <main style={{fontFamily: 'monospace', padding: '2rem'}}>
      <h1>basic-integration service</h1>
      <p>Running on port 3002</p>
      <ul>
        <li>GET/POST/PATCH/DELETE /api/users</li>
        <li>GET/POST/PATCH/DELETE /api/products</li>
        <li>GET/POST/PATCH/DELETE /api/orders</li>
      </ul>
    </main>
  );
}
