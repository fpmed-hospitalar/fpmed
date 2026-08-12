-- ============================================================================
-- ALARME DA COLETA — a marca do último aviso enviado por e-mail   (12/08/2026)
--
-- ADITIVO e RODÁVEL 2× (add column if not exists). Não apaga, não converte,
-- não mexe em linha nenhuma.
--
-- ══ POR QUE ESTA COLUNA EXISTE ══════════════════════════════════════════════
-- O alarme da coleta avisa por dois canais: o sino do Negócios e o e-mail do
-- dono. O sino é passivo — ele está aceso quando a pessoa olha. O e-mail é
-- ATIVO: ele chega. E o que chega repetido no mesmo dia deixa de ser lido.
--
-- O `enviar-boletim` roda DUAS vezes por dia (o cron das 08:17 UTC e a rede das
-- 11:23, criada em 11/08 porque o agendador do GitHub atrasa). Sem esta marca,
-- um índice atrasado renderia DOIS e-mails idênticos toda manhã.
--
-- >>> E POR QUE 20 HORAS, E NÃO "UMA VEZ E PRONTO": porque enquanto a coleta
--     estiver parada, o boletim daquele dia NÃO VAI CHEGAR. Um aviso por dia,
--     no lugar do boletim que faltou, é o que explica a ausência. Avisar uma
--     única vez na vida faria o 2º, o 3º e o 5º dia de silêncio parecerem
--     normais — que é exatamente a cicatriz que o alarme existe pra impedir
--     ("falha que se conserta sozinha some do olhar").
--     20h e não 24h de propósito: 24h faria o aviso de amanhã cair fora da
--     janela por poucos minutos de atraso do agendador e pular um dia inteiro.
--
-- >>> ELA NÃO É "ALARME LIDO". Ninguém marca nada como lido aqui — é só o
--     carimbo de quando o último e-mail SAIU. O alarme continua aceso no sino
--     enquanto o fato durar, porque o fato é que manda.
-- ============================================================================

alter table public.coleta_status
  add column if not exists alarme_email_em timestamptz;

comment on column public.coleta_status.alarme_email_em is
  'Quando o ultimo e-mail de alarme da coleta saiu. Serve de trava de repeticao (20h) '
  'no enviar-boletim, que roda 2x por dia. Nao e "alarme lido": o sino segue aceso '
  'enquanto o fato durar.';
