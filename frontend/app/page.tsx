export default async function Home(){
  const rest =await fetch('http://localhost:3000/api/health',{
    cache:'no-store'
  });

  const data= await rest.json();
  return (
    <main style={{padding:24}}>
      <h1>
        Hoosh Pro
      </h1>
      <p>Backend Status: {data.status}</p>
      <p>/admin/login</p>
    </main>
  );
}
