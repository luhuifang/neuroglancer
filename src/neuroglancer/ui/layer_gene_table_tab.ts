import { WatchableValueChangeInterface, WatchableValueInterface } from '../trackable_value';
import { RefCounted } from '../util/disposable';
import { removeChildren } from '../util/dom';
import { TabView } from '../widget/tab_view';
import { cancellableFetchSpecialOk } from '../util/special_protocol_request';
import { responseJson } from '../util/http_request';
import {viewer} from 'src/main'
import { DEFAULT_SIDE_PANEL_LOCATION, SidePanelLocation, TrackableSidePanelLocation } from './side_panel_location';
import { emptyToUndefined } from '../util/json';
import { SidePanel, SidePanelManager } from './side_panel';
import 'neuroglancer/ui/layer_gene_table_tab.css';
import './viewer_settings.css';

let reqUrl: any;
let geneIdClickCount:number = 0;
// 创建一个element
export const makeElement = (
    tag: string,
    classes?: string[],
    attrs?: Record<string, any>,
    html?:string): HTMLElement => {
    const el:HTMLElement = document.createElement(tag) as HTMLElement;
    el.classList.add(...(classes ?? []));
    Object.entries(attrs ?? {})
        .forEach(([key, value]) => el.setAttribute(key, value));
    el.innerHTML = (html ?? '');
    return el;
};
// 默认span Attribute
const defaultSpans = {'colspan': '1', 'rowspan': '1'}
// 创建一个单元格
const makeCell = (
    // 允许传入 innerText，元素，或者是产生他们的函数
    supplier: string | HTMLElement | ( () => HTMLElement | string ), exAttr?:Record<string, string>
): HTMLTableCellElement => {
    const td = makeElement("td", [], defaultSpans) as HTMLTableCellElement;
    const cell = makeElement("div", ["cell"], exAttr);
    // 如果是函数，就拿到执行结果（否则本来就是需要的内容对象/字符串）
    const content:any = typeof supplier === "function" ? supplier() : supplier;
    if (typeof content !== 'object') {
        cell.innerHTML = content;
    } else {
        cell.appendChild(content);
    }
    td.appendChild(cell);
    return td;
};
// 创建一个sort
const makeSort = (
    // 允许传入 innerText，元素，或者是产生他们的函数
    supplier: string | HTMLElement | (() => HTMLElement[]),text?:string
): HTMLTableCellElement => {
    const div = makeElement("div", [], {},text) as HTMLTableCellElement;
    const span = makeElement("span", ["caret-wrapper"]);
    // 如果是函数，就拿到执行结果（否则本来就是需要的内容对象/字符串）
    const content:any = typeof supplier === "function" ? supplier() : supplier;
    span.appendChild(content[0]);
    span.appendChild(content[1]);
    div.appendChild(span);
    return div;
};
const DEFAULT_GENE_PANEL_LOCATION: SidePanelLocation = {
    ...DEFAULT_SIDE_PANEL_LOCATION,
    side: 'left',
    row: 3,
  };
export class genePanelState {
    location = new TrackableSidePanelLocation(DEFAULT_GENE_PANEL_LOCATION);
    get changed() {
      return this.location.changed;
    }
    toJSON() {
      return emptyToUndefined(this.location.toJSON());
    }
    reset() {
      this.location.reset();
    }
    restoreState(obj: unknown) {
      this.location.restoreState(obj);
    }
  }
export class GeneTabView extends SidePanel {
    [x: string]: any;
    element = document.createElement('div');
    tabBar = document.createElement('div');
    tbody = document.createElement('tbody');
    button = document.createElement('button');
    tabs: WatchableValueChangeInterface<{id: string, label: string}[]>;
    selectedTab: WatchableValueInterface<string|undefined>;
    pagenum:any = 1;
    sortname:any;
    isasc:any;
    filterparam:any;
    geneElement = document.createElement('div');
    listEle = document.createElement('table');
    pagenation = document.createElement('div');
    totalPage:any;
    tabView: TabView;
    json = viewer.state.toJSON();
    constructor(sidePanelManager: SidePanelManager, state: genePanelState) {
        super(sidePanelManager, state.location);
        const {element, tabBar} = this;
        element.className = 'neuroglancer-annotation-geneTable-tab';
        tabBar.className = 'neuroglancer-tab-gene-view-bar';
        tabBar.innerHTML = 'Gene Table';
        element.appendChild(tabBar);
        this.element.appendChild(this.geneTableHead());
        this.element.appendChild(this.geneFiiter());
        this.initGeneTable(this.json.layers[0].source);
    }
    async initGeneTable(value: string){
        reqUrl = value
        removeChildren(this.listEle);
        removeChildren(this.pagenation);
        removeChildren(this.tbody);
        this.geneElement.classList.add('gene-table');
        this.geneElement.appendChild( await this.geneTableList());
        this.element.appendChild(this.geneElement);
        if(this.totalPage){
            this.geneElement.appendChild(this.genePagenation());
            this.element.appendChild(this.geneTableReset());
        };
    }
    private geneTableHead(){
        const TableHead = makeElement('div', ['geneTable-head'])
        const geneSort = makeSort(()=>{
            const ascI = makeElement('i', ['sort-caret', 'ascending', 'gene'], {'dataFlag': 'false'});
            const descI = makeElement('i', ['sort-caret', 'descending', 'gene'], {'dataFlag': 'false'});
            return [ascI, descI]
        }, 'Gene');
        const countSort = makeSort(()=>{
            const ascI = makeElement('i', ['sort-caret', 'ascending', 'MIDcount'], {'dataFlag': 'false'});
            const descI = makeElement('i', ['sort-caret', 'descending', 'MIDcount'], {'dataFlag': 'false'});
            return [ascI, descI]
        }, 'MIDcount');
        const E10Sort = makeSort(()=>{
            const ascI = makeElement('i', ['sort-caret', 'ascending', 'E10'], {'dataFlag': 'false'});
            const descI = makeElement('i', ['sort-caret', 'descending', 'E10'], {'dataFlag': 'false'});
            return [ascI, descI]
        }, 'E10');
        TableHead.appendChild(geneSort);
        TableHead.appendChild(countSort);
        TableHead.appendChild(E10Sort);
        for(let i = 0; i < 6; i++){
            TableHead.getElementsByTagName('i')[i].addEventListener('click', (event: Event)=>{
                TableHead.getElementsByTagName('i')[0].style.borderBottomColor = '#c0c4cc'
                TableHead.getElementsByTagName('i')[1].style.borderTopColor = '#c0c4cc'
                TableHead.getElementsByTagName('i')[2].style.borderBottomColor = '#c0c4cc'
                TableHead.getElementsByTagName('i')[3].style.borderTopColor = '#c0c4cc'
                TableHead.getElementsByTagName('i')[4].style.borderBottomColor = '#c0c4cc'
                TableHead.getElementsByTagName('i')[5].style.borderTopColor = '#c0c4cc'
                const dataFlag = (event.target as Element).getAttribute('dataFlag')
                TableHead.getElementsByTagName('i')[i].setAttribute('dataFlag', dataFlag === 'true'?'false':'true')
                if( (event.target as Element).classList.contains('ascending')){
                    TableHead.getElementsByTagName('i')[i].style.borderBottomColor = dataFlag === 'true'? '#c0c4cc':'#409eff'
                }else{
                    TableHead.getElementsByTagName('i')[i].style.borderTopColor = dataFlag === 'true'? '#c0c4cc':'#409eff'
                }
                this.sortname = dataFlag === 'true' ?'' :(event.target as Element).classList[2]
                this.isasc = (event.target as Element).classList[1] == 'ascending'
                this.initGeneTable(reqUrl)
            })
        }
        return TableHead
    }
    private geneFiiter(){
        const inputEle = document.createElement('input');
        inputEle.placeholder = 'please enter GeneID';
        inputEle.addEventListener('change',(event: Event)=>{
            this.filterparam = (event.target as any).value;
            this.initGeneTable(reqUrl);
        })
        return inputEle
    }
    async geneTableList(){
        this.listEle.classList.add('el-table')
        this.listEle.appendChild(this.tbody)
        const res = await this.getGeneTabledata();
        if(res?.code === 200){
            this.totalPage = res.totalpage
            res.data.forEach((item:any)=>{
                const tr = document.createElement('tr')
                const tdCheckbox = makeCell(() => {
                    const cb = makeElement("input") as HTMLInputElement;
                    // 如果再给 makeElement 加上 props 参数，都不需要写工厂函数了
                    cb.type = "checkbox";
                    return cb;
                });
                const tdGene = makeCell(item.gene, {'value':item.gene, 'title': item.gene});
                const tdMIDCount = makeCell(item.MIDcount, {'value':item.gene, 'title': item.MIDcount});
                const tdE10 = makeCell(item.E10.toFixed(2), {'value':item.gene, 'title': item.E10.toFixed(2)});
                tr.appendChild(tdCheckbox)
                tr.appendChild(tdGene)
                tr.appendChild(tdMIDCount)
                tr.appendChild(tdE10)
                this.tbody.appendChild(tr)
                this.listEle.appendChild(this.tbody);
                tr.addEventListener('click', (event:Event) =>{
                    geneIdClickCount++;
                    // 清空上一个点选内容
                    if(document.getElementsByClassName('success-row')[0]){
                        document.getElementsByClassName('success-row')[0].className = '';
                    }
                    // 判断是否选中td，是则该行的tr添加success-row类名
                    tr.classList.add('success-row');
                    this.changeGeneId( (event.target as Element).attributes[1].value, false);
                });
            })
        }else{
            this.listEle.innerHTML = `<div class="nodata">暂无数据</div>`
        }
        return this.listEle
    }
    private genePagenation(){
        const pageCurr = makeElement('input', [], {'value': this.pagenum})as HTMLButtonElement;
        const prevBtn = makeElement('button', ['btn-prev'], {}, '上一页')as HTMLButtonElement;
        const pageDiv = makeElement('div', ['el-pager'], {}, '');
        const pageTotal = makeElement('p', ['el-pager'], {}, this.totalPage);
        const pageInner = makeElement('p', [], {}, '/');
        const nextBtn = makeElement('button', ['btn-next'], {}, '下一页')as HTMLButtonElement;
        this.pagenation.classList.add('el-pagination');
        prevBtn.type = 'button';
        nextBtn.type = 'button';
        pageCurr.type = 'text';
        this.pagenation.appendChild(prevBtn);
        this.pagenation.appendChild(pageDiv);
        this.pagenation.appendChild(nextBtn);
        pageDiv.appendChild(pageCurr);
        pageDiv.appendChild(pageInner);
        pageDiv.appendChild(pageTotal);
        prevBtn.addEventListener('click',()=>{
            if(this.pagenum > 1){
                this.pagenum = this.pagenum - 1;
                pageCurr.setAttribute('value', this.pagenum);
                this.initGeneTable(reqUrl);
            }else{
                window.confirm('已经是第一页了!');
            }
        })
        nextBtn.addEventListener('click',()=>{
            if(this.pagenum < this.totalPage){
                this.pagenum = this.pagenum + 1;
                pageCurr.setAttribute('value', this.pagenum);
                this.initGeneTable(reqUrl);
            }else{
                window.confirm('已经是最后一页了!');
            }
        });
        pageCurr.addEventListener('change',(event:Event)=>{
            event.stopPropagation();
            if( Number( (event.target as HTMLInputElement ).value) >= 1 && (event.target as HTMLInputElement ).value < this.totalPage){
                this.pagenum = (event.target as HTMLInputElement ).value;
                this.initGeneTable(reqUrl);
            }else{
                window.confirm('输入页码不合法！')
                pageCurr.value = this.pagenum;
            }
            console.log(this.pagenum)
        })
        return this.pagenation
    }
    geneTableReset(){
        this.button.classList.add('el-button','el-button--default','is-plain');
        this.button.innerHTML = `<span>RESET</span>`;
        this.button.addEventListener('click',()=>{
            if(document.getElementsByClassName('success-row')[0]){
                document.getElementsByClassName('success-row')[0].className = ''
            }
            if(geneIdClickCount > 0){
                let resetUrl = viewer.state.toJSON().layers[0].source.split('/');
                var len = resetUrl.indexOf('gene');
                resetUrl.splice(len, 2, 'dnb');
                var newUrl = resetUrl.join('/')
                this.changeGeneId( newUrl, true);
            }
            geneIdClickCount = 0;
        });
        return this.button;
    }
    formatter(num:any){
        return String(num).replace(/(\d{1,3})(?=(\d{3})+(?:$|\.))/g,'$1,');
    }
    getGeneTabledata(): Promise<any> {
        let host:any
        let url:any;
        reqUrl = reqUrl ? reqUrl : viewer.state.toJSON().layers[0].source;
        console.log(reqUrl)
        if(reqUrl){
            host = reqUrl.split('/')
            url = host[2] + '//' + host[4] + '/' + host[5] +'/annotation/genelist';
            url = url + '?pagesize=' + 15;
            url = url + '&pagenum=' + this.pagenum;
            url = this.filterparam?url + '&filterparam=' + this.filterparam : url;
            url = this.sortname?url + '&sort={"name":"' + this.sortname + '","isAsc":' + this.isasc+'}' : url;
            return cancellableFetchSpecialOk(undefined, `${url}`, {}, responseJson);
        }else{
            return reqUrl
        }
    }
    changeGeneId(value:any, flag:boolean = false){
        let lastParam:any = '';
        let newJson = viewer.state.toJSON();
        if(!flag){
            let inputValue = newJson.layers[0].source.split('/');
            // 判断是否包含bin
            let num = inputValue.includes('bin')?1:2;
            inputValue.splice(inputValue.indexOf('annotation') + 1, inputValue.length - num - inputValue.indexOf('annotation'), 'gene/'+value);
            lastParam = inputValue.join('/');
        }else{
            lastParam = value;
        }
        newJson.layers[0].source = lastParam;
        viewer.state.reset();
        viewer.state.restoreState(newJson);
        console.log(newJson)
    }
}
let isCloseFlag = false
export class geneCloseBtn extends RefCounted {
    closeIcon = document.createElement('div'); 
    closeSpan = document.createElement('p')
    constructor(){
        super();
        this.closeIcon.classList.add('geneTableIsClose');
        this.closeIcon.innerHTML = '<svg t="1638952305823" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2310" width="20" height="20"><path d="M849 509.3L456.27 904.74a32 32 0 0 0 45.41 45.1L917 531.7a32 32 0 0 0-0.16-45.25L501.53 74a32 32 0 1 0-45.1 45.41z" p-id="2311"></path><path d="M499.78 509.3L107.05 904.74a32 32 0 0 0 45.41 45.1L567.74 531.7a32 32 0 0 0-0.16-45.25L152.31 74a32 32 0 0 0-45.1 45.41z" p-id="2312"></path></svg>'
        this.closeSpan.innerText = 'fold';
        this.closeIcon.appendChild(this.closeSpan);
        this.closeIcon.addEventListener('click', ()=>{
            isCloseFlag = !isCloseFlag;
            (document.getElementsByClassName('neuroglancer-annotation-geneTable-tab')[0] as HTMLElement).style.width = isCloseFlag?'40px':'15%';
            // this.closeIcon.style.left = isCloseFlag ? '40px':'15%';
            (document.getElementsByClassName('stereomapContaioner')[0] as HTMLElement).style.marginLeft = isCloseFlag ? '40px': '18%';
            (document.getElementsByClassName('neuroglancer-tab-gene-view-bar')[0] as HTMLElement).style.display = isCloseFlag ? 'none': 'block';
            (document.getElementsByClassName('geneTable-head')[0] as HTMLElement).style.display = isCloseFlag ? 'none': 'flex';
            (document.getElementsByClassName('gene-table')[0] as HTMLElement).style.display = isCloseFlag ? 'none': 'block';
            (document.getElementsByClassName('el-button--default')[0] as HTMLElement).style.display = isCloseFlag ? 'none': 'block';
            (document.getElementsByClassName('neuroglancer-annotation-geneTable-tab')[0].getElementsByTagName('input')[0] as HTMLElement).style.display = isCloseFlag ? 'none': 'block';
            this.closeSpan.innerText = isCloseFlag ? '': 'fold';
            (this.closeIcon.getElementsByClassName('icon')[0] as HTMLElement).style.transform = isCloseFlag ? 'rotate(0deg)':'rotate(180deg)';
            if(isCloseFlag){
                (document.getElementsByClassName('geneTable-head')[0] as HTMLElement).classList.remove('isFlex');
                (document.getElementsByClassName('gene-table')[0] as HTMLElement).style.display = 'none'
            }else{
                (document.getElementsByClassName('geneTable-head')[0] as HTMLElement).classList.add('isFlex');
            }
        })
    }
}
