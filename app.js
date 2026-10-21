/* ============================================================
   1. DADOS FIXOS DA EMPRESA E CAMPOS
   ============================================================ */
const CFG = document.getElementById('config').dataset;
const EMP = {
    nome: CFG.nome, end: CFG.endereco, zap: CFG.whatsapp,
    ig: CFG.instagram, resp: CFG.responsavel, slogan: CFG.slogan
};
const pct = v => parseFloat(String(v).replace(',', '.')) || 0;
const TAXA = { vista: pct(CFG.taxaVista), parc: pct(CFG.taxaParcelado), max: parseInt(CFG.maxParcelas) || 12 };
const KEY = 'ds_os_v1', LG = 'ds_logo';
const FLD = [['nome', 'Nome completo'], ['doc', 'CPF / CNPJ'], ['tel', 'Telefone'], ['cel', 'Celular / WhatsApp'], ['end', 'Endereço', 'w2'], ['numc', 'Número e complemento'], ['emp', 'Empresa / agência', 'w2'],
['marca', 'Marca'], ['modelo', 'Modelo'], ['ano', 'Ano'], ['cor', 'Cor'], ['placa', 'Placa'], ['km', 'Quilometragem'],
['servico', 'Serviço realizado / Descrição'], ['defeitos', 'Defeitos apontados pelo cliente'], ['recom', 'Serviços recomendados'], ['obs', 'Observações gerais'], ['pagto', 'Forma de pagamento'], ['garcond', 'Condições de garantia'], ['garprazo', 'Prazo de garantia'], ['outras', 'Outras informações importantes']];

/* ============================================================
   2. FUNÇÕES UTILITÁRIAS
   ============================================================ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = v => {
    v = parseFloat(String(v).replace(',', '.'));
    return isNaN(v) || v < 0 ? 0 : v
};
const toast = m => {
    const t = $('#toast');
    t.textContent = m;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2500)
};

/* ============================================================
   3. ESTADO GLOBAL
   ============================================================ */
let cur = null;
// OS em edição

/* ============================================================
   4. ARMAZENAMENTO PERSISTENTE
   ============================================================ */
const load = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || {
            n: 0, list: []
        }

    } catch (e) {
        return { n: 0, list: [] }
    }

};
const store = d => {
    try {
        localStorage.setItem(KEY, JSON.stringify(d));
        return true
    } catch (e) {
        alert('Não foi possível salvar: armazenamento do navegador cheio ou bloqueado.');
        return false
    }

};
const byId = id => load().list.find(o => o.id == id);

/* ============================================================
   5. OS EM BRANCO E CÁLCULOS
   ============================================================ */
const blank = () => ({ id: null, numero: null, status: 'rascunho', criada: null, emitida: null, items: [{ d: '', q: 1, u: 0 }], desc: 0, mo: 0, pg: { t: '0', p: 2, m: 'div' }, semCusto: false, semTipo: 'SEM CUSTO' });

function calc(o) {
    const sub = o.items.reduce((a, i) => a + Math.round(num(i.q) * num(i.u) * 100), 0), d = Math.round(num(o.desc) * 100), m = Math.round(num(o.mo) * 100);
    let t = Math.max(0, sub + m - d);
    if (o.semCusto) t = 0;
    return { sub, d, m, t, over: d > sub + m }
}

/* ============================================================
   5.1 CÁLCULO DE TAXAS DA MAQUININHA (taxas ficam no index.html)
   ============================================================ */
// c = valor em centavos | tipo: '0' sem taxa, 'v' crédito à vista, 'p' crédito parcelado
// met: 'div' = valor ÷ (1 − taxa)  (você recebe o valor cheio)
//      'mul' = valor × (1 + taxa)  (soma simples da taxa)
function taxaCalc(c, tipo, parc, met) {
    if (tipo === '0' || c <= 0) return { taxa: 0, total: c, parcela: c, n: 1, acr: 0 };
    const t = (tipo === 'v' ? TAXA.vista : TAXA.parc) / 100;
    const n = tipo === 'v' ? 1 : Math.max(2, parseInt(parc) || 2);
    const total = met === 'mul' ? Math.round(c * (1 + t)) : Math.round(c / (1 - t));
    return { taxa: t * 100, total, n, parcela: Math.ceil(total / n), acr: total - c };
}

function pagTexto(o) {
    const p = o.pg || {};
    if (!p.t || p.t === '0' || o.semCusto) return o.pagto || '';
    const r = taxaCalc(calc(o).t, p.t, p.p, p.m);
    const f = p.t === 'v' ? 'Crédito à vista' : 'Crédito parcelado ' + r.n + 'x de ' + brl(r.parcela);
    return [o.pagto, f + ' — total no cartão ' + brl(r.total) + ' (inclui taxa da maquininha)'].filter(Boolean).join('\n');
}

function simCampos(pre) {
    const par = Array.from({ length: Math.max(1, TAXA.max - 1) }, (_, i) => `<option value="${i + 2}">${i + 2}x</option>`).join('');
    return `<div><label>Forma de pagamento</label><select id="${pre}t" onchange="simAtual('${pre}')">
    <option value="0">Pix / dinheiro (sem taxa)</option>
    <option value="v">Crédito à vista (${TAXA.vista}%)</option>
    <option value="p">Crédito parcelado (${TAXA.parc}%)</option></select></div>
   <div><label>Parcelas</label><select id="${pre}p" onchange="simAtual('${pre}')">${par}</select></div>
   <div><label>Cálculo da taxa</label><select id="${pre}m" onchange="simAtual('${pre}')">
    <option value="div">Receber o valor cheio (valor ÷ (1 − taxa))</option>
    <option value="mul">Somar a taxa (valor × (1 + taxa))</option></select></div>`;
}

function simSet(pre, pg) {
    pg = pg || { t: '0', p: 2, m: 'div' };
    $('#' + pre + 't').value = pg.t; $('#' + pre + 'p').value = pg.p; $('#' + pre + 'm').value = pg.m;
}

function simAtual(pre) {
    const t = $('#' + pre + 't').value, p = $('#' + pre + 'p').value, m = $('#' + pre + 'm').value;
    $('#' + pre + 'p').disabled = t !== 'p';
    if (pre === 'pg' && cur) cur.pg = { t, p: parseInt(p), m };
    const base = pre === 'sm' ? Math.round(num($('#smv').value) * 100) : calc(cur).t;
    const r = taxaCalc(base, t, p, m);
    $('#' + pre + 'r').innerHTML = t === '0' ? `<div class="fin"><span>TOTAL (sem taxa)</span><span>${brl(base)}</span></div>` :
        `<div><span>Valor</span><span>${brl(base)}</span></div>
     <div><span>Taxa da maquininha (${r.taxa}%)</span><span>+ ${brl(r.acr)}</span></div>
     <div class="fin"><span>TOTAL NO CARTÃO</span><span>${brl(r.total)}</span></div>
     <div><span>${r.n === 1 ? 'À vista' : r.n + 'x de'}</span><span>${brl(r.parcela)}</span></div>`;
}

/* ============================================================
   6. TELA INICIAL, HISTÓRICO E BUSCA
   ============================================================ */

function rows(list) {
    if (!list.length) return '<p style="color:var(--mu)">Nenhuma ordem de serviço encontrada.</p>';
    return `<div class="tw"><table class="l"><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Veículo</th><th>Placa</th><th>Total</th><th></th></tr>` + list.map(o => {
        const c = calc(o);
        return `<tr><td><b>${esc(o.numero)}</b> <span class="badge ${o.status == 'emitida' ? 'e' : 'd'}">${o.status}</span></td><td>${new Date(o.criada).toLocaleDateString('pt-BR')}</td><td>${esc(o.nome) || '—'}</td><td>${esc((o.marca || '') + ' ' + (o.modelo || ''))}</td><td>${esc(o.placa)}</td><td>${o.semCusto ? esc(o.semTipo) : brl(c.t)}</td>
 <td class="acts"><button class="sm" onclick="ver('${o.id}')">Ver</button><button class="sm" onclick="editar('${o.id}')">Editar</button><button class="sm" onclick="dup('${o.id}')">Duplicar</button><button class="sm dg" onclick="del('${o.id}')">Excluir</button></td></tr>`
    }).join('') + '</table></div>'
}

function busca(q) {
    q = q.trim().toLowerCase();
    const l = load().list.slice().reverse();
    if (!q) return l;
    return l.filter(o => [o.numero, o.nome, o.placa, new Date(o.criada).toLocaleDateString('pt-BR'), o.criada.slice(0, 10)].some(x => String(x || '').toLowerCase().includes(q)))
}

function home() {
    cur = null;
    const d = load(), l = d.list, mes = new Date().toISOString().slice(0, 7),
        tm = l.filter(o => o.status == 'emitida' && o.criada.startsWith(mes));
    $('#main').innerHTML = `<div class="card hero"><h1 style="margin:0 0 6px">Ordens de Serviço</h1><p>${esc(EMP.slogan)}</p><button class="pr" onclick="novaOS()">+ Nova Ordem de Serviço</button></div>
 <div class="stats"><div class="stat"><b>${l.length}</b>OS registradas</div><div class="stat"><b>${l.filter(o => o.status == 'rascunho').length}</b>Rascunhos</div><div class="stat"><b>${tm.length}</b>Emitidas no mês</div><div class="stat"><b>${brl(tm.reduce((a, o) => a + calc(o).t, 0))}</b>Total emitido no mês</div></div>
 <div class="card"><h2>Simulador de cartão (maquininha)</h2><div class="g"><div><label>Valor (R$)</label><input id="smv" type="number" min="0" step="0.01" placeholder="0,00" oninput="simAtual('sm')"></div>${simCampos('sm')}</div><div class="tot" id="smr"></div></div>
 <div class="card"><h2>Buscar OS</h2><input id="q" placeholder="Número, cliente, placa ou data (dd/mm/aaaa)" oninput="$('#res').innerHTML=rows(busca(this.value).slice(0,this.value?200:5))"><div id="res" style="margin-top:12px">${rows(busca('').slice(0, 5))}</div>${l.length > 5 ? '<button class="sm" onclick="hist()">Ver histórico completo</button>' : ''}</div>`
        ; simSet('sm'); simAtual('sm');
}

function hist() {
    cur = null;
    $('#main').innerHTML = `<div class="card"><h2>Histórico de OS</h2><input placeholder="Buscar por número, cliente, placa ou data" oninput="$('#res').innerHTML=rows(busca(this.value))"><div id="res" style="margin-top:12px">${rows(busca(''))}</div></div>`
}

/* ============================================================
   7. FORMULÁRIO DA OS
   ============================================================ */

function novaOS() {
    if (cur && $('#f_nome') && dirty() && !confirm('Há dados preenchidos. Limpar e iniciar nova OS?')) return;
    cur = blank();
    form()
}
const dirty = () => {
    read();
    return FLD.some(f => cur[f[0]]) || cur.items.some(i => i.d)
};
const fld = (k, l, c = '') => {
    const big = ['servico', 'defeitos', 'recom', 'obs', 'garcond', 'outras'].includes(k);
    return `<div class="${big ? 'wf' : c}"><label>${l}</label>${big ? `<textarea id="f_${k}" rows="${k == 'servico' ? 6 : 3}">${esc(cur[k])}</textarea>` : `<input id="f_${k}" value="${esc(cur[k])}">`}</div>`
};

function form() {
    const F = a => a.map(k => { const f = FLD.find(x => x[0] == k); return fld(f[0], f[1], f[2]) }).join('');
    $('#main').innerHTML = `<h2 style="margin-top:0">${cur.numero ? 'OS ' + esc(cur.numero) : 'Nova Ordem de Serviço'}</h2>
 <div class="card"><h2>1. Cliente</h2><div class="g">${F(['nome', 'doc', 'tel', 'cel', 'end', 'numc', 'emp'])}</div></div>
 <div class="card"><h2>2. Veículo</h2><div class="g">${F(['marca', 'modelo', 'ano', 'cor', 'placa', 'km'])}</div></div>
 <div class="card"><h2>3. Serviço realizado</h2><div class="g">${F(['servico'])}</div></div>
 <div class="card"><h2>4. Serviços e peças</h2><div id="items"></div><button onclick="addItem()">+ Adicionar item</button></div>
 <div class="card"><h2>5. Valores</h2><div class="g"><div><label>Desconto (R$)</label><input id="f_desc" type="number" min="0" step="0.01" value="${cur.desc || ''}" oninput="tot()"></div><div><label>Mão de obra (R$)</label><input id="f_mo" type="number" min="0" step="0.01" value="${cur.mo || ''}" oninput="tot()"></div>
 <div><label>Sem custo (cortesia/garantia)</label><select id="f_sc" onchange="tot()"><option value="0">Não — cobrar normalmente</option><option value="SEM CUSTO" ${cur.semCusto && cur.semTipo == 'SEM CUSTO' ? 'selected' : ''}>Sim — exibir "SEM CUSTO"</option><option value="R$ 0,00" ${cur.semCusto && cur.semTipo == 'R$ 0,00' ? 'selected' : ''}>Sim — exibir "R$ 0,00"</option></select></div></div>
 <div class="tot" id="tots"></div></div>
 <div class="card"><h2>6. Pagamento no cartão (simulação sobre o total da OS)</h2><div class="g">${simCampos('pg')}</div><div class="tot" id="pgr"></div></div>
 <div class="card"><h2>7. Observações e condições</h2><div class="g">${F(['defeitos', 'recom', 'obs', 'pagto', 'garprazo', 'garcond', 'outras'])}</div></div>
 <div class="bar"><button class="pr" onclick="gerar()">Gerar OS</button><button onclick="rascunho()">Salvar rascunho</button><button onclick="novaOS()">Nova OS</button><button onclick="home()">Cancelar</button></div>`;
    drawItems();
    simSet('pg', cur.pg);
    tot()
}

function drawItems() {
    $('#items').innerHTML = cur.items.map((i, n) => `<div class="it"><div style="color:var(--mu)">${String(n + 1).padStart(3, '0')}</div><input placeholder="Descrição do serviço ou peça" value="${esc(i.d)}" oninput="cur.items[${n}].d=this.value">
 <input type="number" min="0" step="any" value="${i.q}" title="Quantidade" oninput="cur.items[${n}].q=this.value;tot()"><input type="number" min="0" step="0.01" placeholder="Valor unit." value="${i.u || ''}" oninput="cur.items[${n}].u=this.value;tot()"><b id="it${n}">${brl(Math.round(num(i.q) * num(i.u) * 100))}</b><button class="sm dg" title="Excluir item" onclick="delItem(${n})">✕</button></div>`).join('')
}

function addItem() {
    read();
    cur.items.push({ d: '', q: 1, u: 0 });
    drawItems();
    tot()
}

function delItem(n) {
    read();
    cur.items.splice(n, 1);
    if (!cur.items.length) cur.items.push({ d: '', q: 1, u: 0 });
    drawItems();
    tot()
}

function read() {
    if (!$('#f_nome')) return;
    FLD.forEach(f => cur[f[0]] = $('#f_' + f[0]).value.trim());
    cur.desc = $('#f_desc').value;
    cur.mo = $('#f_mo').value;
    const s = $('#f_sc').value;
    cur.semCusto = s !== '0';
    if (cur.semCusto) cur.semTipo = s
}

function tot() {
    read();
    cur.items.forEach((i, n) => { const e = $('#it' + n); if (e) e.textContent = brl(Math.round(num(i.q) * num(i.u) * 100)) });
    const c = calc(cur);
    $('#tots').innerHTML = `<div><span>Subtotal</span><span>${brl(c.sub)}</span></div><div><span>Mão de obra</span><span>${brl(c.m)}</span></div><div><span>Desconto</span><span>− ${brl(c.d)}</span></div>${c.over ? '<div style="color:#ff6b6b">Desconto maior que o total: valor final = R$ 0,00</div>' : ''}<div class="fin"><span>TOTAL</span><span>${cur.semCusto ? esc(cur.semTipo) : brl(c.t)}</span></div>`
    simAtual('pg');
}

function valid() {
    read();
    if (!cur.nome && !cur.placa) {
        alert('Informe ao menos o nome do cliente ou a placa do veículo para identificar a OS.');
        return false
    }
    if (cur.items.some(i => (i.q !== '' && isNaN(parseFloat(i.q))) || parseFloat(i.q) < 0 || parseFloat(i.u) < 0)) {
        alert('Quantidade e valores não podem ser negativos.');
        return false
    }
    if (calc(cur).over && !confirm('O desconto é maior que o total. Continuar mesmo assim (total = R$ 0,00)?')) return false;
    return true
}

function save(st) {
    const d = load(), now = new Date().toISOString();
    if (!cur.id) {
        cur.id = 'os' + Date.now();
        d.n++;
        cur.numero = 'OS-' + String(d.n).padStart(6, '0');
        cur.criada = now
    }
    cur.items = cur.items.filter((i, n) => i.d || num(i.u) || n == 0 && false);
    if (!cur.items.length) cur.items = [{ d: '', q: 1, u: 0 }];
    if (st == 'emitida' && cur.status != 'emitida') cur.emitida = now;
    if (st == 'emitida') cur.emitida = cur.emitida || now;
    cur.status = st;
    const k = d.list.findIndex(o => o.id == cur.id);
    if (k >= 0) d.list[k] = cur;
    else d.list.push(cur);
    return store(d)
}

function rascunho() {
    read();
    if (!dirty()) {
        alert('Nada para salvar.');
        return
    }
    if (!cur.nome && !cur.placa && !confirm('Salvar sem cliente/placa?')) return;
    if (save('rascunho')) {
        toast('Rascunho salvo: ' + cur.numero);
        form()
    }

}

function gerar() {
    if (!valid()) return;
    if (save('emitida')) {
        toast(cur.numero + ' gerada');
        preview(cur)
    }

}

/* ============================================================
   8. AÇÕES SOBRE OS SALVAS
   ============================================================ */

function editar(id) {
    cur = JSON.parse(JSON.stringify(byId(id)));
    form()
}

function dup(id) {
    const o = JSON.parse(JSON.stringify(byId(id)));
    o.id = null;
    o.numero = null;
    o.status = 'rascunho';
    o.criada = o.emitida = null;
    cur = o;
    form();
    toast('Cópia criada — será salva com novo número')
}

function del(id) {
    const o = byId(id);
    if (!confirm('Excluir a ' + o.numero + ' definitivamente?')) return;
    const d = load();
    d.list = d.list.filter(x => x.id != id);
    store(d);
    toast('OS excluída');
    $('#q') ? home() : hist()
}

function ver(id) {
    cur = JSON.parse(JSON.stringify(byId(id)));
    preview(cur)
}

/* ============================================================
   9. DOCUMENTO A4, IMPRESSÃO E PDF
   ============================================================ */

function docHTML(o) {
    const c = calc(o), lg = localStorage.getItem(LG), dt = new Date(o.emitida || o.criada).toLocaleString('pt-BR');
    const kv = (l, v, c = '') => `<div class="${c}"><i>${l}</i>${esc(v) || '—'}</div>`, tx = (t, v) => v ? `<div class="sec">${t}</div><div class="txt">${esc(v)}</div>` : '';
    return `<div class="dh">${lg ? `<img src="${lg}">` : ''}<div class="co"><h1>DYNAMICS SOM</h1><b>FILM, ACESSÓRIOS E ESTÉTICA AUTOMOTIVA</b><br>${esc(EMP.end)}<br>WhatsApp ${EMP.zap} · Instagram ${EMP.ig}<br>Responsável: ${EMP.resp}</div><div class="no">ORDEM DE SERVIÇO<b>${esc(o.numero)}</b>Emissão: ${dt}</div></div>
 <div class="sec">Cliente</div><div class="kv">${kv('Nome', o.nome, 's2')}${kv('CPF/CNPJ', o.doc)}${kv('Telefone', o.tel)}${kv('Celular/WhatsApp', o.cel)}${kv('Endereço', o.end, 's2')}${kv('Nº/Compl.', o.numc)}${kv('Empresa/Agência', o.emp, 's4')}</div>
 <div class="sec">Veículo</div><div class="kv">${kv('Marca', o.marca)}${kv('Modelo', o.modelo)}${kv('Ano', o.ano)}${kv('Cor', o.cor)}${kv('Placa', o.placa)}${kv('Km', o.km)}</div>
 ${tx('Serviço realizado / Descrição', o.servico)}${tx('Defeitos apontados pelo cliente', o.defeitos)}
 <div class="sec">Serviços e peças</div><table><thead><tr><th>Cód.</th><th>Descrição</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Total</th></tr></thead><tbody>${o.items.filter(i => i.d || num(i.u)).map((i, n) => `<tr><td>${String(n + 1).padStart(3, '0')}</td><td>${esc(i.d)}</td><td class="r">${esc(i.q)}</td><td class="r">${o.semCusto ? '—' : brl(Math.round(num(i.u) * 100))}</td><td class="r">${o.semCusto ? '—' : brl(Math.round(num(i.q) * num(i.u) * 100))}</td></tr>`).join('') || '<tr><td colspan="5">Sem itens lançados</td></tr>'}</tbody></table>
 <div class="tt">${o.semCusto ? '' : `<div><span>Subtotal</span><span>${brl(c.sub)}</span></div><div><span>Mão de obra</span><span>${brl(c.m)}</span></div><div><span>Desconto</span><span>− ${brl(c.d)}</span></div>`}<div class="f"><span>TOTAL</span><span>${o.semCusto ? esc(o.semTipo) : brl(c.t)}</span></div></div>
 ${tx('Serviços recomendados', o.recom)}${tx('Observações', o.obs)}${tx('Forma de pagamento', pagTexto(o))}${tx('Garantia — prazo', o.garprazo)}${tx('Garantia — condições', o.garcond)}${tx('Outras informações', o.outras)}
 <div class="sg"><div>Assinatura do cliente</div><div>Assinatura / visto do funcionário</div></div><div class="sl">“${esc(EMP.slogan)}”</div>`
}

function preview(o) {
    $('#main').innerHTML = `<div class="bar"><button class="pr" onclick="imprimir()">Imprimir</button><button class="pr" onclick="baixarPDF()">Baixar PDF</button><button class="pr" onclick="baixarPNG()">Baixar PNG</button><button onclick="editar('${o.id}')">Editar OS</button><button onclick="dup('${o.id}')">Duplicar OS</button><button onclick="novaOS()">Nova OS</button><button onclick="hist()">Histórico</button></div><div id="sheet">${docHTML(o)}</div>`;
    window.scrollTo(0, 0)
}

function imprimir(pdf) {
    const o = cur;
    if (!o) return;
    $('#printRoot').innerHTML = '<div id="sheet">' + docHTML(o) + '</div>';
    const t = document.title;
    document.title = o.numero + (o.nome ? ' - ' + o.nome : '');
    if (pdf) toast('Na janela que abrir, escolha o destino “Salvar como PDF”');
    setTimeout(() => { window.print(); document.title = t }, pdf ? 900 : 50)
}

/* ============================================================
   9.1 DOWNLOAD DIRETO EM PDF E PNG (sem bibliotecas, funciona offline)
   ============================================================ */
function baixar(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const nomeArq = o => (o.numero + (o.nome ? ' - ' + o.nome : '')).replace(/[\\/:*?"<>|]/g, '').trim();

// Desenha a OS (A4 = 794px de largura) em um canvas, em alta resolução
async function docCanvas(o) {
    const W = 794, S = 2;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + W + 'px';
    host.innerHTML = '<div id="sheet">' + docHTML(o) + '</div>';
    document.body.appendChild(host);
    const src = host.firstChild, clone = src.cloneNode(true);
    const a = [src, ...src.querySelectorAll('*')], b = [clone, ...clone.querySelectorAll('*')];
    a.forEach((e, i) => {
        const cs = getComputedStyle(e); let t = '';
        for (const p of cs) t += p + ':' + cs.getPropertyValue(p) + ';';
        b[i].setAttribute('style', t);
    });
    clone.style.margin = '0';
    const H = Math.max(1123, src.scrollHeight), top = src.getBoundingClientRect().top;
    const cuts = [...src.querySelectorAll('tbody tr,.sec,.tt,.sg')].map(e => Math.round(e.getBoundingClientRect().top - top));
    host.remove();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject width="100%" height="100%">' + new XMLSerializer().serializeToString(clone) + '</foreignObject></svg>';
    const img = new Image();
    await new Promise((ok, er) => { img.onload = ok; img.onerror = () => er(new Error('render')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) });
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0, W * S, H * S);
    return { cv, W, H, S, cuts };
}

async function baixarPNG() {
    if (!cur) return;
    try {
        toast('Gerando PNG...');
        const { cv } = await docCanvas(cur);
        cv.toBlob(bl => { baixar(bl, nomeArq(cur) + '.png'); toast('PNG baixado') }, 'image/png');
    } catch (e) { alert('Não foi possível gerar o PNG neste navegador. Use o Chrome ou o Edge.') }
}

async function baixarPDF() {
    if (!cur) return;
    try {
        toast('Gerando PDF...');
        const { cv, W, H, S, cuts } = await docCanvas(cur);
        const PH = 1123, pad = 40, pages = []; let y = 0;
        while (y < H - 1) {
            let end = Math.min(H, y + (y ? PH - 2 * pad : PH));
            if (end < H) { const c = cuts.filter(t => t > y + 60 && t <= end); if (c.length) end = Math.max(...c) }
            pages.push([y, end]); y = end;
        }
        const jpgs = pages.map(([y0, y1], i) => {
            const pc = document.createElement('canvas'); pc.width = W * S; pc.height = PH * S;
            const g = pc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, pc.width, pc.height);
            g.drawImage(cv, 0, y0 * S, W * S, (y1 - y0) * S, 0, (i ? pad : 0) * S, W * S, (y1 - y0) * S);
            const bin = atob(pc.toDataURL('image/jpeg', 0.92).split(',')[1]);
            const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++)bytes[k] = bin.charCodeAt(k);
            return { bytes, w: pc.width, h: pc.height };
        });
        baixar(montarPDF(jpgs), nomeArq(cur) + '.pdf'); toast('PDF baixado');
    } catch (e) { alert('Não foi possível gerar o PDF direto. Use Imprimir e escolha "Salvar como PDF".') }
}

// Monta um arquivo PDF válido (uma imagem JPEG por página A4)
function montarPDF(jpgs) {
    const enc = new TextEncoder(), parts = [], off = []; let len = 0;
    const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length };
    const obj = (n, body) => { off[n] = len; add(n + ' 0 obj\n'); body.forEach(add); add('\nendobj\n') };
    const N = jpgs.length, total = 3 + 3 * N;
    add('%PDF-1.4\n');
    obj(1, ['<</Type/Catalog/Pages 2 0 R>>']);
    obj(2, ['<</Type/Pages/Count ' + N + '/Kids[' + jpgs.map((_, i) => (3 + 3 * i) + ' 0 R').join(' ') + ']>>']);
    jpgs.forEach((j, i) => {
        const p = 3 + 3 * i, cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
        obj(p, ['<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Contents ' + (p + 1) + ' 0 R/Resources<</XObject<</Im0 ' + (p + 2) + ' 0 R>>>>>>']);
        obj(p + 1, ['<</Length ' + cs.length + '>>\nstream\n' + cs + '\nendstream']);
        obj(p + 2, ['<</Type/XObject/Subtype/Image/Width ' + j.w + '/Height ' + j.h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + j.bytes.length + '>>\nstream\n', j.bytes, '\nendstream']);
    });
    const xr = len;
    add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (let n = 1; n < total; n++)add(String(off[n]).padStart(10, '0') + ' 00000 n \n');
    add('trailer\n<</Size ' + total + '/Root 1 0 R>>\nstartxref\n' + xr + '\n%%EOF');
    return new Blob(parts, { type: 'application/pdf' });
}

/* ============================================================
   10. LOGOTIPO
   ============================================================ */

function logo() {
    const l = localStorage.getItem(LG);
    $('#logoBox').innerHTML = l ? `<img src="${l}">` : '<span style="color:var(--mu);font-size:12px;border:1px dashed var(--ln);padding:12px">Clique aqui para inserir o logotipo</span>'
}
$('#logoBox').onclick = () => $('#logoIn').click();
$('#logoIn').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        const im = new Image();
        im.onload = () => {
            const s = Math.min(1, 600 / im.width), cv = document.createElement('canvas');
            cv.width = im.width * s;
            cv.height = im.height * s;
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            try {
                localStorage.setItem(LG, cv.toDataURL('image/png'));
                logo();
                toast('Logotipo salvo')
            } catch (x) {
                alert('Imagem grande demais para salvar.')
            }

        };
        im.src = r.result
    };
    r.readAsDataURL(f)
};

/* ============================================================
   11. NAVEGAÇÃO E INICIALIZAÇÃO
   ============================================================ */

function go(v) {
    if (v === 'home') home();
    else if (v === 'hist') hist()
}
logo();
home();