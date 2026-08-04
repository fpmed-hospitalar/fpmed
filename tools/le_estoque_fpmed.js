// Leitor do espelho de estoque proprio da FPMED (xlsx) -> objetos normalizados.
// SO LEITURA de arquivo. Nao toca banco. Usado pelo tools/importa_estoque_fpmed.js e pelos testes.
const XLSX = require('xlsx');

// Colunas esperadas (case/acento-insensivel): CODIGO, NOME_PRODUTO, UNIDADE, MARCA, ESTOQUE, PRECO_MINIMO1
const COLS = {
  codigo:   ['codigo','cod','codigoproduto','codproduto'],
  produto:  ['nomeproduto','produto','descricao','nome'],
  und:      ['unidade','und','un','embalagem'],
  marca:    ['marca','laboratorio','lab','fabricante'],
  estoque:  ['estoque','saldo','qtd','quantidade'],
  preco:    ['precominimo1','precominimo','preco','precovenda','venda'],
};

// tira diacriticos sem depender de classe de caractere literal no fonte
function semAcento(s) {
  let out = '';
  for (const c of String(s).normalize('NFD')) {
    const k = c.codePointAt(0);
    if (k >= 0x300 && k <= 0x36f) continue;
    out += c;
  }
  return out;
}
const norm = s => semAcento(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

// "1.234,56" / "1234.56" / "R$ 12,90" -> Number. Regra: virgula manda quando ha virgula.
function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// CODIGO do ERP e string de 7 digitos com zeros a esquerda (0000010), NUNCA numero.
// O xlsx entrega a celula como number quando ela e so digito, e ai o zero some — foi assim que
// o import de 04/08 gravou 1.381 codigos truncados (0000010 -> 10) e quebraria a chave do
// proximo import (nao casaria e duplicaria). Normaliza SEMPRE, na leitura.
// Codigo com mais de 7 digitos ou nao-numerico passa intacto (nao inventa formato).
const COD_LARGURA = 7;
function normCodigo(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (!/^[0-9]+$/.test(s)) return s;
  return s.length >= COD_LARGURA ? s : s.padStart(COD_LARGURA, '0');
}

function mapaColunas(header) {
  const idx = {};
  (header || []).forEach((h, i) => { const n = norm(h); if (n && idx[n] === undefined) idx[n] = i; });
  const achou = {};
  for (const [campo, nomes] of Object.entries(COLS)) {
    for (const nome of nomes) { if (idx[nome] !== undefined) { achou[campo] = idx[nome]; break; } }
  }
  return achou;
}

/** Le a planilha e devolve {linhas, col, aba, header, descartadas}. */
function lerEstoque(caminho) {
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const aba = wb.SheetNames[0];
  const grade = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '', raw: true });

  // O cabecalho nem sempre e a linha 1 — acha a 1a linha que resolve codigo+produto+preco.
  let hIdx = -1, col = null;
  for (let i = 0; i < Math.min(grade.length, 20); i++) {
    const c = mapaColunas(grade[i]);
    if (c.codigo !== undefined && c.produto !== undefined && c.preco !== undefined) { hIdx = i; col = c; break; }
  }
  if (hIdx < 0) throw new Error('cabecalho nao encontrado (preciso de CODIGO, NOME_PRODUTO e PRECO_MINIMO1 nas 20 primeiras linhas)');

  const linhas = [], descartadas = [];
  for (let i = hIdx + 1; i < grade.length; i++) {
    const r = grade[i] || [];
    const get = k => (col[k] === undefined ? '' : r[col[k]]);
    const produto = String(get('produto') == null ? '' : get('produto')).trim();
    const codigo  = normCodigo(get('codigo'));
    if (!produto && !codigo) continue;                                  // linha em branco: ignora calada
    if (!produto) { descartadas.push({ linha: i + 1, codigo, motivo: 'sem NOME_PRODUTO' }); continue; }

    const preco = num(get('preco'));
    const estoqueBruto = num(get('estoque'));
    linhas.push({
      linhaPlanilha: i + 1,
      codigo,
      produto,
      und: String(get('und') == null ? '' : get('und')).trim() || null,
      marca: String(get('marca') == null ? '' : get('marca')).trim() || null,
      estoqueBruto: estoqueBruto == null ? 0 : estoqueBruto,
      preco,
    });
  }
  return { linhas, col, aba, header: grade[hIdx], descartadas };
}

module.exports = { lerEstoque, num, norm, semAcento, mapaColunas, normCodigo, COD_LARGURA };
