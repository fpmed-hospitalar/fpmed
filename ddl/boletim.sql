-- ============================================================
-- FPMED — BOLETIM DIÁRIO por e-mail (módulo 2.14 da spec) · 10/08/2026
--
-- O QUE ENTRA AQUI: o jornal (busca salva) passa a poder ser ENVIADO. A tela já dava o delta
-- ("8 novas desde a sua última leitura"); o que faltava era o empurrão — alguém que só abre o
-- sistema quando lembra não vê o edital que abre amanhã.
--
-- >>> POR QUE `vistos_email` É SEPARADO DE `vistos`, e esta é A decisão desta migração:
--     `vistos` é o que a PESSOA já viu na tela. Se o e-mail carimbasse ali, o boletim das 5h
--     "leria" o jornal por ela — e ao abrir o sistema às 8h a tela diria "nada novo" sobre
--     exatamente as licitações que ela ainda não olhou. Um canal apagaria a novidade do outro.
--     Dois leitores, duas memórias.
--
-- >>> `enviar_email` NASCE FALSE. Jornal que já existe não começa a mandar e-mail sozinho porque
--     o provedor foi contratado — quem assina o boletim é quem pede.
--
-- >>> `email_destino` NULO significa "o e-mail de quem é dono do jornal", lido do auth na hora
--     do envio. Guardar uma cópia do e-mail aqui criaria um endereço que envelhece: a pessoa
--     troca o e-mail no cadastro e o boletim continua indo pro antigo, calado.
--
-- >>> `ultimo_envio_erro` existe pela mesma razão de `coleta_status.ultimo_erro`: envio que
--     falha em silêncio vira "o boletim parou de chegar e ninguém sabe por quê".
--
-- ADITIVA: só acrescenta colunas em tabela existente. Zero DELETE, UPDATE ou DROP.
-- Seguro re-rodar.
-- ============================================================

alter table public.jornais
  add column if not exists enviar_email      boolean not null default false,
  add column if not exists email_destino     text,
  add column if not exists vistos_email      jsonb not null default '[]'::jsonb,
  add column if not exists ultimo_envio      timestamptz,
  add column if not exists ultimo_envio_qtd  int,
  add column if not exists ultimo_envio_erro text;

comment on column public.jornais.enviar_email is
  'Assinatura do boletim diario deste jornal. Nasce FALSE: jornal existente nao comeca a mandar '
  'e-mail sozinho quando o provedor e contratado.';
comment on column public.jornais.vistos_email is
  'Numeros de controle ja ENVIADOS por e-mail neste jornal. Separado de `vistos` de proposito: '
  'o boletim nao pode "ler" o jornal pela pessoa e fazer a tela dizer "nada novo" sobre o que '
  'ela ainda nao olhou.';
comment on column public.jornais.email_destino is
  'NULL = manda pro e-mail do dono do jornal, lido do auth na hora. Copia de e-mail aqui '
  'envelheceria: a pessoa troca no cadastro e o boletim continua indo pro antigo.';

notify pgrst, 'reload schema';
