import { WatchableValueChangeInterface, WatchableValueInterface } from '../trackable_value';
import { RefCounted } from '../util/disposable';
import { removeChildren } from '../util/dom';
import { TabView } from '../widget/tab_view';
import { cancellableFetchSpecialOk } from '../util/special_protocol_request';
import { responseJson } from '../util/http_request';
import 'neuroglancer/ui/layer_gene_table_tab.css'

let reqUrl: any;
// 创建一个element
const makeElement = (
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
export class GeneTabView extends RefCounted {
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
    constructor() {
        super();
        const {element, tabBar} = this;
        element.className = 'neuroglancer-annotation-geneTable-tab';
        tabBar.className = 'neuroglancer-tab-gene-view-bar';
        tabBar.innerHTML = 'Gene Table';
        element.appendChild(tabBar);
        this.element.appendChild(this.geneTableHead());
        this.element.appendChild(this.geneFiiter());
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
        }
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
                this.listEle.appendChild(this.tbody)
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
        return this.button;
    }
    formatter(num:any){
        return String(num).replace(/(\d{1,3})(?=(\d{3})+(?:$|\.))/g,'$1,');
    }
    getGeneTabledata(): Promise<any> {
        let host:any
        let url:any;
        if(reqUrl){
            host = reqUrl.split('/')
            url = host[2] + '//' + host[4] + '/' + host[5] +'/annotation/genelist';
            url = url + '?pagesize=' + 20;
            url = url + '&pagenum=' + this.pagenum;
            url = this.filterparam?url + '&filterparam=' + this.filterparam : url;
            url = this.sortname?url + '&sort={"name":"' + this.sortname + '","isAsc":' + this.isasc+'}' : url;
            let res = async () => {
                return await cancellableFetchSpecialOk(undefined, `${url}`, {}, responseJson);
            };
            return res()
        }else{
            return reqUrl
        }
    }
}
let isCloseFlag = false
export class geneCloseBtn extends RefCounted {
    closeIcon = document.createElement('div'); 
    constructor(){
        super();
        this.closeIcon.classList.add('geneTableIsClose');
        this.closeIcon.innerHTML = '<svg t="1638237158158" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2941" width="48" height="48"><path d="M937.386667 488.106667L772.266667 372.48c-12.8-9.386667-30.293333-6.826667-40.106667 5.546667-3.84 4.693333-5.546667 10.666667-5.546667 17.066666v233.813334c0 22.613333 25.6 36.693333 45.653334 22.613333l165.546666-115.626667c14.08-14.08 14.08-36.693333-0.426666-47.786666zM914.346667 213.333333h-785.066667c-18.773333 0-34.133333-15.36-34.133333-34.133333s15.36-34.133333 34.133333-34.133333h785.066667c18.773333 0 34.133333 15.36 34.133333 34.133333s-14.933333 34.133333-34.133333 34.133333zM914.346667 878.933333h-785.066667c-18.773333 0-34.133333-15.36-34.133333-34.133333s15.36-34.133333 34.133333-34.133333h785.066667c18.773333 0 34.133333 15.36 34.133333 34.133333s-14.933333 34.133333-34.133333 34.133333zM624.213333 435.2h-494.933333c-18.773333 0-34.133333-15.36-34.133333-34.133333s15.36-34.133333 34.133333-34.133334h494.933333c18.773333 0 34.133333 15.36 34.133334 34.133334s-14.933333 34.133333-34.133334 34.133333zM624.64 657.066667H129.28c-18.773333 0-34.133333-15.36-34.133333-34.133334s15.36-34.133333 34.133333-34.133333h495.36c18.773333 0 34.133333 15.36 34.133333 34.133333v0.426667c-0.426667 18.346667-15.36 33.706667-34.133333 33.706667z" fill="#ffffff" p-id="2942"></path></svg>'
        this.closeIcon.addEventListener('click', ()=>{
            isCloseFlag = !isCloseFlag;
            (document.getElementsByClassName('neuroglancer-annotation-geneTable-tab')[0] as HTMLElement).style.width = isCloseFlag?'0%':'15%';
            (this.closeIcon.getElementsByClassName('icon')[0] as HTMLElement).style.transform = isCloseFlag ? 'rotate(0deg)':'rotate(180deg)';
            this.closeIcon.style.left = isCloseFlag ? '0%':'15%';
        })
    }
}
