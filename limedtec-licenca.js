/* LIMEDTEC — LICENCA COM VALIDADE.  Molde puro: nao sabe o nome de nenhum cliente.
 *
 * A DECISAO DO LEMUEL, e ela define o que este arquivo PODE fazer:
 *   - avisa a partir de 10 dias antes ("licenca vence em X dias");
 *   - vencida = MODO LEITURA: consultar, buscar, abrir orcamento salvo, tudo funciona.
 *     So GERAR DOCUMENTO (PDF/proposta) fica bloqueado, com mensagem educada;
 *   - NUNCA apaga nada. NUNCA tranca o acesso do cliente ao dado do proprio cliente.
 * Licenca vencida e cobranca, nao castigo. Um sistema que se fecha sobre os dados de quem
 * atrasou o boleto e um sistema que ninguem instala numa distribuidora.
 *
 * DUAS ESCOLHAS DE ENGENHARIA QUE PARECEM DETALHE E NAO SAO:
 *
 * 1. `agora` ENTRA POR PARAMETRO. Sem isso, testar "vencida" exigiria esperar o vencimento ou
 *    mexer no relogio da maquina — e na pratica ninguem testa, e o caminho de bloqueio so roda
 *    pela primeira vez no computador do cliente. Aqui os tres estados sao testaveis hoje.
 *
 * 2. A CONTA E EM DIA DE CALENDARIO, VIA Date.UTC SOBRE ANO/MES/DIA — nunca em milissegundos
 *    entre dois instantes. Diferenca em ms erra em horario de verao e erra por fuso: ja gravei
 *    um backup datado "2026-08-05" numa madrugada que aqui ainda era dia 04, porque usei
 *    toISOString (UTC) num pais UTC-3. Numa licenca esse erro tira um dia de alguem, ou da um
 *    dia de graca — e o sinal de "vence hoje" chega na hora errada.
 *
 * ESTADOS: 'sem_prazo' · 'valida' · 'a_vencer' · 'vencida'
 * Config ausente, vazia ou com data ilegivel => 'sem_prazo', que NUNCA bloqueia. Bloquear por
 * falta de configuracao seria transformar um erro meu em cliente sem trabalhar.
 */
(function (raiz) {
  'use strict';

  function _dia(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s).trim());
    if (!m) return null;
    var a = +m[1], me = +m[2], d = +m[3];
    if (me < 1 || me > 12 || d < 1 || d > 31) return null;
    // 2026-02-31 e sintaticamente valida e nao existe: o Date normaliza pra marco e a licenca
    // ganharia dias de presente. Conferir a volta pega isso.
    var t = new Date(Date.UTC(a, me - 1, d));
    if (t.getUTCFullYear() !== a || t.getUTCMonth() !== me - 1 || t.getUTCDate() !== d) return null;
    return { a: a, m: me, d: d };
  }

  function _diasEntre(de, ate) {
    return Math.round((Date.UTC(ate.a, ate.m - 1, ate.d) - Date.UTC(de.a, de.m - 1, de.d)) / 86400000);
  }

  // hoje pelo relogio LOCAL (a data de negocio de quem esta olhando a tela), nao UTC
  function _hoje(agora) {
    var d = agora ? new Date(agora) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    return { a: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  function estado(cfg, agora) {
    var lic = (cfg && cfg.licenca) || {};
    var venc = _dia(lic.validade);
    if (!venc) {
      return { estado: 'sem_prazo', dias: null, validade: null, podeGerarDocumento: true,
        aviso: '', motivo: 'sem data de validade configurada' };
    }
    var hoje = _hoje(agora);
    var dias = _diasEntre(hoje, venc);            // 0 = vence hoje (ainda vale o dia inteiro)
    var avisarDias = (lic.avisarDias > 0) ? lic.avisarDias : 10;
    var br = String(venc.d).padStart(2, '0') + '/' + String(venc.m).padStart(2, '0') + '/' + venc.a;
    var suporte = lic.suporte || 'Fale com o suporte.';

    if (dias < 0) {
      return { estado: 'vencida', dias: dias, validade: br, podeGerarDocumento: false,
        aviso: 'Licença vencida em ' + br + '. O sistema está em MODO LEITURA: consulta e busca'
          + ' continuam funcionando, mas não é possível gerar proposta. ' + suporte,
        motivo: 'venceu ha ' + (-dias) + ' dia(s)' };
    }
    if (dias <= avisarDias) {
      return { estado: 'a_vencer', dias: dias, validade: br, podeGerarDocumento: true,
        aviso: dias === 0 ? ('Licença vence HOJE (' + br + '). ' + suporte)
          : ('Licença vence em ' + dias + ' dia' + (dias === 1 ? '' : 's') + ' (' + br + '). ' + suporte),
        motivo: 'faltam ' + dias + ' dia(s)' };
    }
    return { estado: 'valida', dias: dias, validade: br, podeGerarDocumento: true,
      aviso: '', motivo: 'faltam ' + dias + ' dia(s)' };
  }

  // o jeito que as telas usam: LimedtecLicenca() -> estado de agora, com o config do cliente
  function LimedtecLicenca(agora) {
    return estado(raiz.LIMEDTEC_CLIENTE || null, agora);
  }

  // ── O AVISO NA TELA ────────────────────────────────────────────────────────────────────────
  // Aparece a partir de avisarDias e continua depois de vencida. Discreto: uma tarja no topo, sem
  // modal, sem bloquear clique — quem esta no meio de uma cotacao nao pode ser interrompido por
  // uma cobranca. E ela SOME NA IMPRESSAO: aviso de licenca e assunto entre o produto e a
  // distribuidora; o hospital que recebe o PDF nao tem nada com isso. Mesma regra do PDF limpo.
  function avisaNaTela(agora) {
    if (typeof document === 'undefined') return null;
    var e = LimedtecLicenca(agora);
    if (!e.aviso) return null;
    if (document.querySelector('[data-limedtec-aviso]')) return e;
    if (!document.getElementById('limedtec-aviso-css')) {
      var st = document.createElement('style'); st.id = 'limedtec-aviso-css';
      st.textContent = '@media print{[data-limedtec-aviso]{display:none !important}}';
      document.head.appendChild(st);
    }
    var venceu = e.estado === 'vencida';
    var d = document.createElement('div');
    d.setAttribute('data-limedtec-aviso', e.estado);
    d.setAttribute('role', 'status');
    // >>> EMBAIXO, NAO EM CIMA. A 1a versao era uma tarja no topo e ela COBRIU o cabecalho da
    //     cotacao — logo, chip de sessao e os botoes Abrir/Salvar sumiram atras dela. Reservar
    //     espaco no topo exigiria saber a altura do header de cada cliente, e este arquivo e
    //     MOLDE: ele vai rodar em telas que eu nunca vi. O rodape nao disputa espaco com nada,
    //     e o unico elemento que vive la e o botao de instalar, que e meu tambem e sobe sozinho
    //     (via --limedtec-rodape).
    document.documentElement.style.setProperty('--limedtec-rodape', '38px');
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147482000;padding:7px 14px;'
      + 'text-align:center;font:600 12.5px Inter,system-ui,sans-serif;letter-spacing:.2px;'
      + (venceu ? 'background:#5a1f1f;color:#ffd9d9;border-top:1px solid #8a3131'
               : 'background:#4a3a12;color:#ffe9b8;border-top:1px solid #7a6020');
    d.textContent = e.aviso;
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '×';
    x.setAttribute('aria-label', 'fechar');
    x.style.cssText = 'position:absolute;right:10px;top:4px;background:none;border:0;color:inherit;'
      + 'font-size:17px;line-height:1;cursor:pointer;opacity:.7';
    // vencida tambem pode ser fechada: a tarja e recado, o bloqueio de verdade esta no portao de
    // qualidade. Trava que so incomoda, sem impedir, ensina o usuario a ignorar aviso.
    x.addEventListener('click', function () {
      d.remove();
      document.documentElement.style.setProperty('--limedtec-rodape', '0px');
    });
    d.appendChild(x);
    (document.body || document.documentElement).appendChild(d);
    return e;
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { avisaNaTela(); });
    else avisaNaTela();
  }

  raiz.LimedtecLicencaAviso = avisaNaTela;
  raiz.LimedtecLicenca = LimedtecLicenca;
  raiz.LimedtecLicencaEstado = estado;          // versao pura, pros testes e pro Node
  if (typeof module !== 'undefined' && module.exports) module.exports = { estado: estado, LimedtecLicenca: LimedtecLicenca };
})(typeof window !== 'undefined' ? window : globalThis);
