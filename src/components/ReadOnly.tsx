/** 보기 전용(관리자 회원): 안의 입력칸·버튼을 모두 비활성화한다. 실제 수정은 서버에서도 막는다 */
export function ReadOnly({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <fieldset disabled className="contents">
      {children}
    </fieldset>
  );
}

export function ReadOnlyNotice({ on }: { on: boolean }) {
  return on ? <p className="rounded-lg bg-gray-100 p-3 text-sm text-gray-700">보기 전용입니다 (관리자 회원은 수정할 수 없습니다).</p> : null;
}
