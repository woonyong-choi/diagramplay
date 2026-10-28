// 기능별 복잡한 회귀 예제를 같은 페이지에서 검수한다.
import { readFileSync } from 'node:fs';

const sourceOf = file => {
  const source = readFileSync(new URL(`../../examples/${file}.diagramplay`, import.meta.url), 'utf8');
  return /^width /m.test(source) ? source : source.replace('diagramplay\n', 'diagramplay\nwidth wide\n');
};
const beforeView = (source, addition) => source.replace(/\nview /, `\n${addition}\nview `);
const architecture = sourceOf('authentication/commerce-nhn').replace('waf -> gateway\n', 'waf -> gateway no=1\n').replace('gateway -> bff\n', 'gateway -> bff no=2\n');
const flow = beforeView(sourceOf('flow').replace('view graph down', 'view graph right').replace('track web, app, partner -> api -> stocked -> lock -> db "주문"', 'track web, app, partner -> api -> stocked -> lock -> db'), `
box fraud "위험 검증"
decision approved "승인 성공?"
store paymentdb "결제 이력"
queue retry "지연 재시도" slots=4 from=2
queue failed "실패 격리" slots=4 from=1
box notifier "알림 처리"
external mail "메일 서비스"
store audit "감사 기록"
api -> fraud "검증" no=1
fraud -> pay
pay -> approved "승인 결과" no=2
approved -> paymentdb "성공"
approved -> retry "실패" dashed
retry -> pay "다시 시도" dashed
retry -> failed "횟수 초과" dashed
paymentdb -> notifier "결제 완료"
notifier -> mail "알림"
failed -> audit "격리 기록" dashed
`);
const classifier = beforeView(sourceOf('class'), `
interface payment-port "PaymentGateway" {
  method authorize "(order: Order): boolean" visibility=public
}
interface publisher "EventPublisher" {
  method publish "(event: OrderEvent): void" visibility=public
}
class service "OrderService" {
  method place "(order: Order): void" visibility=public
  method cancel "(id: UUID): void" visibility=public
}
class card-gateway "CardPaymentGateway" {
  field timeout "Duration" visibility=private
  method authorize "(order: Order): boolean" visibility=public
}
class payment "Payment" {
  field id "UUID" visibility=private
  field amount "Money" visibility=private
  method approve "(): void" visibility=public
}
class shipment "Shipment" {
  field trackingNo "string" visibility=private
  method dispatch "(): void" visibility=public
}
class address "Address" {
  field city "string" visibility=private
  field zipCode "string" visibility=private
}
class money "Money" {
  field amount "decimal" visibility=private
  field currency "string" visibility=private
}
service -> repository relation=dependency "저장 계약"
service -> payment-port relation=dependency "승인 계약"
service -> publisher relation=dependency "이벤트 발행"
service -> order relation=dependency "주문 생성"
card-gateway -> payment-port relation=realization
order -> payment relation=composition from="1" to="0..*" "결제"
order -> shipment relation=association from="1" to="0..1" "배송"
customer -> address relation=aggregation from="1" to="0..*" "주소"
payment -> money relation=composition from="1" to="1" "금액"
line -> product relation=association from="*" to="1" "상품"
shipment -> address relation=association "배송지"
`);
let schema = sourceOf('schema').replace('table users "users" {', 'table users "users" {\n  tenant_id UUID fk=tenants.id required').replace('  user_id bigint fk=users.id required ondelete=restrict', '  tenant_id UUID fk=tenants.id required\n  user_id bigint fk=users.id required ondelete=restrict\n  fk (tenant_id, user_id) -> memberships (tenant_id, user_id) ondelete=restrict from="0..*" to="1"').replaceAll('bigint', 'UUID');
schema = beforeView(schema, `
table tenants "tenants" {
  id UUID pk
  name text required
}
table memberships "memberships" {
  tenant_id UUID fk=tenants.id required
  user_id UUID fk=users.id required
  role text required
  pk (tenant_id, user_id)
}
table payments "payments" {
  id UUID pk
  order_id UUID fk=orders.id required ondelete=cascade
  amount decimal required
  status text required
}
table refunds "refunds" {
  id UUID pk
  payment_id UUID fk=payments.id required ondelete=restrict
  amount decimal required
}
table shipments "shipments" {
  id UUID pk
  order_id UUID fk=orders.id required ondelete=cascade
  tracking_no text unique nullable
}
table inventory "inventory" {
  tenant_id UUID fk=tenants.id required
  product_id UUID fk=products.id required
  available int required
  pk (tenant_id, product_id)
}
`);

export const COMPARISON_EXAMPLES = [
  { id: 'architecture', label: '아키텍처', note: '다중 영역·동기 호출·이벤트·재시도·추적 · 결제사 지연 상태', source: architecture, scene: 2, alt: '요청이 인증과 주문 서비스를 지나 저장·이벤트·재시도·외부 연동으로 이어진다' },
  { id: 'flow', label: '카드 흐름', note: '17개 처리 요소·동시 요청·조건·잠금·실패 격리', source: flow, scene: 5, alt: '세 채널의 동시 주문이 재고 잠금과 결제를 거쳐 실패 시 재시도 또는 격리된다' },
  { id: 'sequence', label: '시퀀스', note: '동시 분기·선택·선택 실행·재시도·생성·소멸', source: sourceOf('sequence'), scene: 0, alt: '재고와 결제를 동시 확인하고 승인 분기와 알림 및 작업자 생명주기를 실행한다' },
  { id: 'class', label: '클래스', note: '16개 클래스·계약·상속·구현·합성·집합·의존', source: classifier, scene: 0, alt: '주문 도메인의 상속·합성 관계와 저장·결제·이벤트 계약의 구현을 연결한다' },
  { id: 'schema', label: 'ERD', note: '11개 테이블·복합 키·다중 외래 키·자기 참조·삭제 정책', source: schema, scene: 0, alt: '테넌트와 회원의 복합 키에 주문·결제·배송·재고의 외래 키와 삭제 정책이 연결된다' },
];
