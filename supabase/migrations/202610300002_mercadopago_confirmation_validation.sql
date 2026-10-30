-- Reemplaza solamente la función: rechaza datos de pago incompletos.
begin;

create or replace function public.confirm_test_mercadopago_payment(
  p_order_id uuid, p_payment_id text, p_amount numeric, p_currency text, p_collector_id text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  checkout public.mercadopago_checkouts%rowtype;
  line jsonb;
begin
  select * into checkout from public.mercadopago_checkouts where id = p_order_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if p_payment_id is null or p_payment_id !~ '^[0-9]{1,30}$' then
    raise exception 'Identificador de pago inválido';
  end if;
  if p_currency is distinct from 'ARS' or p_amount is distinct from checkout.total or p_collector_id is distinct from checkout.collector_id then
    raise exception 'El pago no coincide con el pedido';
  end if;
  if checkout.status = 'paid' then
    if checkout.payment_id <> p_payment_id then raise exception 'Pedido pagado con otro pago'; end if;
    return;
  end if;
  insert into public.mercadopago_test_orders(id, payment_method, status, total)
  values (checkout.id, 'Mercado Pago (prueba)', 'paid', checkout.total);
  for line in select * from jsonb_array_elements(checkout.items) loop
    insert into public.mercadopago_test_order_items(order_id, product_id, product_name, sku, quantity, unit_price)
    values (checkout.id, (line->>'product_id')::uuid, line->>'title', line->>'sku', (line->>'quantity')::integer, (line->>'unit_price')::numeric);
  end loop;
  update public.mercadopago_checkouts set status = 'paid', payment_id = p_payment_id, paid_at = now() where id = checkout.id;
end;
$$;

revoke all on function public.confirm_test_mercadopago_payment(uuid,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.confirm_test_mercadopago_payment(uuid,text,numeric,text,text) to service_role;

commit;
