-- ============================================================
-- FPMED — POLICIES DO STORAGE para o bucket `documentos` (08/08/2026)
--
-- O bucket é PRIVADO: certidão, balanço e contrato social não podem ter URL pública
-- adivinhável. Privado, porém, quer dizer "só quem a policy deixar" — e sem policy nenhuma
-- ninguém sobe e ninguém lê, nem o gestor. Estas quatro linhas são o que faz o módulo existir.
--
-- >>> A SIMETRIA COM A TABELA É PROPOSITAL: na `documentos`, todo logado LÊ e só gestor ESCREVE.
--     Aqui é igual. Se o arquivo fosse mais frouxo que a ficha, bastaria adivinhar o caminho
--     para ler o balanço da empresa sem passar pela tabela; se fosse mais rígido, o vendedor
--     veria "CND Federal · vence em 12 dias" na lista e levaria 400 ao tentar abrir o PDF —
--     um sistema que mostra o que não deixa ver.
--
-- >>> `bucket_id = 'documentos'` em TODAS: policy de storage vale para o schema inteiro, e sem
--     esse filtro estas regras passariam a valer para qualquer bucket criado no futuro —
--     inclusive um que alguém criasse público, para outra finalidade.
--
-- Seguro re-rodar.
-- ============================================================

drop policy if exists docs_storage_le    on storage.objects;
drop policy if exists docs_storage_sobe  on storage.objects;
drop policy if exists docs_storage_troca on storage.objects;
drop policy if exists docs_storage_apaga on storage.objects;

-- LER: todo logado (o vendedor precisa abrir a certidão para montar a habilitação)
create policy docs_storage_le on storage.objects for select to authenticated
  using (bucket_id = 'documentos');

-- SUBIR / TROCAR / APAGAR: só gestor — trocar uma certidão é ato de quem responde pela empresa
create policy docs_storage_sobe on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.cargo_gestor());

create policy docs_storage_troca on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and public.cargo_gestor())
  with check (bucket_id = 'documentos' and public.cargo_gestor());

create policy docs_storage_apaga on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.cargo_gestor());
