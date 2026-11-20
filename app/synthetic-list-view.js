import {compareSyntheticListResults} from './territory-comparison.js?v=20261120data35';
import {escapeHTML as esc} from './core.js';
import {electionBallotLabel} from './election-labels.js';

// Jeu fermé de démonstration : aucun résultat réel et aucune correspondance nominative.
export const syntheticListFixture = () => ({
 schemaVersion:1,synthetic:true,
 ballots:[2020,2026].map((annee,i)=>({id:i?'b':'a',type:'muni',tour:'t1',annee,date:annee+'-03-15',source:{label:'Jeu de démonstration fictif '+(i?'B':'A'),date:'2026-11-20'}})),
 results:[
  {ballotId:'a',codeInsee:'33001',exprimes:200,listes:[{id:'a-1',label:'Liste fictive A1',votes:50},{id:'a-2',label:'Liste fictive A2',votes:150}]},
  {ballotId:'b',codeInsee:'33001',exprimes:300,listes:[{id:'b-1',label:'Liste fictive B1',votes:180},{id:'b-2',label:'Liste fictive B2',votes:120}]},
  {ballotId:'a',codeInsee:'33002',exprimes:0,listes:[{id:'a-1',label:'Liste fictive A1',votes:0},{id:'a-2',label:'Liste fictive A2',votes:0}]},
  {ballotId:'b',codeInsee:'33002',exprimes:100,listes:[{id:'b-1',label:'Liste fictive B1',votes:100},{id:'b-2',label:'Liste fictive B2',votes:0}]},
  {ballotId:'a',codeInsee:'33003',exprimes:100,listes:[{id:'a-1',label:'Liste fictive A1',votes:40},{id:'a-2',label:'Liste fictive A2',votes:60}]},
 ],
});
const communes=[['33001','Commune fictive 1'],['33002','Commune fictive 2'],['33003','Commune fictive 3']];
export function viewSyntheticListComparison(state,data=syntheticListFixture()){
 const options=(values,selected)=>values.map(([id,label])=>'<option value="'+esc(id)+'" '+(id===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
 const lists=id=>[...new Map(data.results.filter(r=>r.ballotId===id).flatMap(r=>r.listes).map(l=>[l.id,l.label]))];
 const select=(key,label,values)=>'<label>'+label+'<select data-list-field="'+key+'">'+options(values,state[key])+'</select></label>';
 const controls=select('firstId','Scrutin fictif A',data.ballots.map(b=>[b.id,electionBallotLabel(b)]))+
 select('secondId','Scrutin fictif B',data.ballots.filter(b=>b.id!==state.firstId).map(b=>[b.id,electionBallotLabel(b)]))+
 select('listAId','Liste A',[['','Choisir une liste'],...lists(state.firstId)])+
 select('listBId','Liste B',[['','Choisir une liste'],...lists(state.secondId)])+
 select('metric','Mesure',[['votes','Voix'],['share','Pourcentage des exprimés']]);
 const codes=communes.filter(([code])=>state.codes.includes(code));
 let body='<p role="status">Choisissez explicitement une liste pour chaque scrutin.</p>';
 if(!codes.length)body='<p role="status">Sélectionnez au moins une commune fictive.</p>';
 else if(state.listAId&&state.listBId){
  const r=compareSyntheticListResults(data,state);
  const number=v=>v===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
  const status=v=>v.status!=='available'?'Résultat ou liste indisponible':state.metric==='share'&&v.shareStatus==='zero-denominator'?'Aucun exprimé : pourcentage indisponible':'Disponible';
  body='<p role="status">'+r.coverage.paired+'/'+r.coverage.requested+' comparaisons disponibles · '+esc(r.unit)+' · B − A</p>'+
   '<div class="tablewrap" style="max-width:100%;overflow-x:auto"><table><caption>Comparaison de listes fictives</caption><thead><tr><th>Commune fictive</th><th>A</th><th>B</th><th>Écart B − A</th><th>Disponibilité A / B</th></tr></thead><tbody>'+
   r.items.map(v=>'<tr><th scope="row">'+esc(communes.find(c=>c[0]===v.codeInsee)[1])+'</th><td>'+number(v.a)+'</td><td>'+number(v.b)+'</td><td>'+(v.delta===null?'—':(v.delta>0?'+':'')+number(v.delta))+'</td><td>'+esc(status(v.first))+' / '+esc(status(v.second))+'</td></tr>').join('')+'</tbody></table></div>';
 }
 return '<h3>Comparer des listes — démonstration fictive</h3><p>Jeu entièrement fictif, indépendant des filtres géographiques et des résultats publics ci-dessus. Aucun rapprochement de personnes ou de nuances. Choix temporaires sur cet écran ; export et sauvegarde non disponibles.</p>'+
 '<div class="form-inline profile-controls">'+controls+'</div><fieldset><legend>Communes fictives</legend>'+communes.map(([id,label])=>'<label style="display:block"><input type="checkbox" data-list-code="'+id+'" '+(state.codes.includes(id)?'checked':'')+'> '+label+'</label>').join('')+'</fieldset>'+body+
 data.ballots.filter(b=>[state.firstId,state.secondId].includes(b.id)).map(b=>'<p class="hint">'+esc(electionBallotLabel(b))+' · Date du scrutin fictif : '+esc(b.date)+' · Source : '+esc(b.source.label)+' · mise à jour '+esc(b.source.date)+'</p>').join('')+
 '<p class="hint">Les absences ne valent pas zéro. Les pourcentages utilisent les exprimés ; blancs et nuls sont exclus. Ces écarts descriptifs ne prouvent aucun transfert individuel de voix.</p>';
}
if(typeof customElements!=='undefined'&&!customElements.get('synthetic-list-comparison')){
 customElements.define('synthetic-list-comparison',class extends HTMLElement{
  connectedCallback(){
   this.style.display='block';this.style.minWidth='0';
   this.state={codes:communes.map(c=>c[0]),firstId:'a',secondId:'b',listAId:'',listBId:'',metric:'votes'};
   this.render();
   this.onchange=e=>{
    e.stopPropagation();
    const field=e.target.dataset.listField,code=e.target.dataset.listCode;
    if(code)this.state.codes=e.target.checked?[...new Set([...this.state.codes,code])]:this.state.codes.filter(c=>c!==code);
    if(field){
     this.state[field]=e.target.value;
     if(field==='firstId'){this.state.secondId=this.state.firstId==='a'?'b':'a';this.state.listAId='';this.state.listBId='';}
     if(field==='secondId'){this.state.listBId='';}
    }
    this.render();
    if(field)this.querySelector('[data-list-field="'+field+'"]')?.focus({preventScroll:true});
   };
  }
  render(){this.innerHTML=viewSyntheticListComparison(this.state);}
 });
}
