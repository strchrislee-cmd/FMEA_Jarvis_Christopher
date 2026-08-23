// 간단한 고유 id 생성
export function newId(): string {
  return crypto.randomUUID()
}
