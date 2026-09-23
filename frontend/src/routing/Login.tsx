import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../customHooks/AuthContext";

/**
 * Login.tsx
 * ------------------------------------------------------------------
 * Login form (/login route). Posts credentials to the backend's
 * /login endpoint (server.js) after validating client-side via zod.
 * On success, hands the returned JWT to AuthContext's login() - which
 * is what actually establishes the session app-wide (see AuthContext.tsx).
 * ------------------------------------------------------------------
 */

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email({ error: "Please enter a valid email" })),
  password: z.string().min(1, "Password is required"),
});

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid email or password");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Storing the token via AuthContext is what makes the session
        // "real" — Header.tsx and App.tsx's PublicOnly guard both react
        // to this via useAuth() immediately after this call.
        login(data.token);
        navigate("/");
      } else {
        setError(data.message || "Incorrect email or password.");
      }
    } catch {
      // Network-level failure (server down, no connection, etc.) rather
      // than a rejected login — distinct from the `else` branch above.
      setError("Unable to connect to the server.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Welcome back to DEV@Deakin!</h1>
          <div className="auth-field">
            <label htmlFor="login-email">Your email</label>
            <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">Your password</label>
            <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
            {error && <p className="auth-error auth-form-error" role="alert">{error}</p>}
          <button className="auth-button" type="submit" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </button>
          <Link className="auth-switch" to="/signup">Sign up</Link>
        </form>
      </div>
    </div>
  );
}

export default Login;