"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [state, action, pending] = useActionState(login, initialState);
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        <span>운영자 이메일</span>
        <input name="email" type="email" autoComplete="email" required placeholder="scout@example.com" />
      </label>
      <label>
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="10자 이상"
        />
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "확인 중…" : "로그인"} <ArrowRight size={17} />
      </button>
    </form>
  );
}
