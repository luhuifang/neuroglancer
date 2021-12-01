import { WatchableValueChangeInterface, WatchableValueInterface } from '../trackable_value';
import { RefCounted } from '../util/disposable';
import { removeChildren } from '../util/dom';
import { TabView } from '../widget/tab_view';
import { cancellableFetchSpecialOk } from '../util/special_protocol_request';
import { responseJson } from '../util/http_request';
import 'neuroglancer/ui/layer_gene_table_tab.css'

let reqUrl: any;
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
        // this.initGeneTable(reqUrl);
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
        console.log(this.element)
    }
    private geneTableHead(){
        const TableHead = document.createElement('div')
        TableHead.classList.add('geneTable-head')
        const geneSort = document.createElement('div')
        const countSort = document.createElement('div')
        const E10Sort = document.createElement('div')
        const geneSpan = document.createElement('span')
        const countSpan = document.createElement('span')
        const E10Span = document.createElement('span')
        const geneSortASC = document.createElement('i')
        const geneSortDESC = document.createElement('i')
        const countSortASC = document.createElement('i')
        const countSortDESC = document.createElement('i')
        const E10SortASC = document.createElement('i')
        const E10SortDESC = document.createElement('i')
        geneSpan.classList.add('caret-wrapper')
        countSpan.classList.add('caret-wrapper')
        E10Span.classList.add('caret-wrapper')
        countSortASC.classList.add('sort-caret', 'ascending', 'MIDcount')
        countSortDESC.classList.add('sort-caret', 'descending', 'MIDcount')
        countSortASC.setAttribute('dataFlag', 'false')
        countSortDESC.setAttribute('dataFlag', 'false')
        geneSortASC.classList.add('sort-caret', 'ascending', 'gene')
        geneSortASC.setAttribute('dataFlag', 'false')
        geneSortDESC.classList.add('sort-caret', 'descending', 'gene')
        geneSortDESC.setAttribute('dataFlag', 'false')
        E10SortASC.classList.add('sort-caret', 'ascending', 'E10')
        E10SortDESC.classList.add('sort-caret', 'descending', 'E10')
        E10SortDESC.setAttribute('dataFlag', 'false')
        E10SortASC.setAttribute('dataFlag', 'false')
        geneSort.innerText = 'Gene'
        geneSpan.appendChild(geneSortASC)
        geneSpan.appendChild(geneSortDESC)
        geneSort.appendChild(geneSpan);
        countSort.innerText = 'MIDcount'
        countSpan.appendChild(countSortASC)
        countSpan.appendChild(countSortDESC)
        countSort.appendChild(countSpan);
        E10Sort.innerText = 'E10'
        E10Span.appendChild(E10SortASC)
        E10Span.appendChild(E10SortDESC)
        E10Sort.appendChild(E10Span);
        TableHead.appendChild(geneSort)
        TableHead.appendChild(countSort)
        TableHead.appendChild(E10Sort)
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
                const tdCheckbox = document.createElement('td')
                const checkDiv = document.createElement('div')
                const checkbox = document.createElement('input')
                checkDiv.classList.add('cell')
                tdCheckbox.setAttribute('rowspan', '1')
                tdCheckbox.setAttribute('colspan', '1')
                checkbox.type = 'checkbox'
                const tdGene = document.createElement('td')
                const gene = document.createElement('div')
                gene.classList.add('cell')
                tdGene.setAttribute('rowspan', '1')
                tdGene.setAttribute('colspan', '1')
                gene.innerText = item.gene
                gene.setAttribute('value', item.gene)
                gene.setAttribute('title', item.gene)
                const tdMIDCount = document.createElement('td')
                const MIDCount = document.createElement('div')
                MIDCount.classList.add('cell')
                tdMIDCount.setAttribute('rowspan', '1')
                tdMIDCount.setAttribute('colspan', '1')
                MIDCount.innerText = this.formatter(item.MIDcount)
                MIDCount.setAttribute('value', item.gene)
                MIDCount.setAttribute('title', this.formatter(item.MIDcount))
                const tdE10 = document.createElement('td')
                const E10 = document.createElement('div')
                E10.classList.add('cell')
                tdE10.setAttribute('rowspan', '1')
                tdE10.setAttribute('colspan', '1')
                E10.innerText = item.E10.toFixed(2)
                E10.setAttribute('value', item.gene)
                E10.setAttribute('title', item.E10.toFixed(2))
                tdCheckbox.appendChild(checkDiv)
                checkDiv.appendChild(checkbox)
                tdGene.appendChild(gene)
                tdMIDCount.appendChild(MIDCount)
                tdE10.appendChild(E10)
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
        const prevBtn = document.createElement('button');
        const pageDiv = document.createElement('div');
        const pageCurr = document.createElement('input');
        const pageTotal = document.createElement('p');
        const pageInner = document.createElement('p');
        const nextBtn = document.createElement('button');
        this.pagenation.classList.add('el-pagination');
        prevBtn.classList.add('btn-prev');
        prevBtn.innerText = '上一页';
        nextBtn.classList.add('btn-next');
        nextBtn.innerText = '下一页';
        prevBtn.type = 'button';
        nextBtn.type = 'button';
        pageCurr.setAttribute('value', this.pagenum.toString());
        pageTotal.innerText = this.totalPage;
        pageInner.innerText = '/';
        pageDiv.classList.add('el-pager');
        this.pagenation.appendChild(prevBtn);
        this.pagenation.appendChild(pageDiv);
        this.pagenation.appendChild(nextBtn);
        pageDiv.appendChild(pageCurr);
        pageDiv.appendChild(pageInner);
        pageDiv.appendChild(pageTotal);
        prevBtn.addEventListener('click',()=>{
            if(this.pagenum > 1){
                this.pagenum = this.pagenum - 1;
                pageCurr.setAttribute('value', this.pagenum.toString());
                this.initGeneTable(reqUrl);
            }else{
                window.confirm('已经是第一页了!');
            }
        })
        nextBtn.addEventListener('click',()=>{
            if(this.pagenum < this.totalPage){
                this.pagenum = this.pagenum + 1;
                pageCurr.setAttribute('value', this.pagenum.toString());
                this.initGeneTable(reqUrl);
            }else{
                window.confirm('已经是最后一页了!');
            }
        });
        pageCurr.addEventListener('change',(event:Event)=>{
            console.log(event);
            this.pagenum = (event.target as HTMLInputElement ).value;
            this.initGeneTable(reqUrl);
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
            console.log(reqUrl)
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
