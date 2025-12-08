"use client"

import { FormEvent,useState } from "react"
import { useRouter } from "next/navigation"
import { apiLogin } from "@/lib/api"

export default function LoginPage(){
    const router =useRouter();

    const [email, setEmail]=useState("");
    const [password,setPassword]=useState("");

    const [error,setError]=useState<string|null>(null);
    const [loading,setLoading]=useState(false);

    async function handleSubmit(event:FormEvent<HTMLFormElement>){
        event.preventDefault();
        setError(null);
        setLoading(true);

        try{
            const data = await apiLogin(email,password);

            localStorage.setItem("hooshpro_token",data.access_token);

            router.push("/");
        }catch (err){
            setError("Email or Password are incorrect, try again");
        }finally{
            setLoading(false);
        }
    }


return (
    <div style={{maxWidth:400,margin:"2rem auto"}}>
        <h1>Hoosh Pro Login</h1>

        <form onSubmit={handleSubmit}>
            <div style={{marginBottom:"1rem"}}>
                <label htmlFor="email">Email</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} required style={{display:"block",width:"100%"}}/>
            </div>

            <div style={{marginBottom:"1rem"}}>
                <label htmlFor="password">Password</label>
                <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required style={{display:"block",width:"100%"}}/>
            </div>

            {error&&(
                <p style={{color:"red",marginBottom:"1rem"}}>{error}</p>
            )}

            <button type="submit" disabled={loading}>
                {loading ? "Login":"...Logging In"}
            </button>
        </form>
    </div>
)
}
