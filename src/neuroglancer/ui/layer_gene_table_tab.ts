import { WatchableValueChangeInterface, WatchableValueInterface } from '../trackable_value';
import { RefCounted } from '../util/disposable';
import { removeChildren } from '../util/dom';
import 'neuroglancer/ui/layer_gene_table_tab.css'
import { TabView } from '../widget/tab_view';

export class GeneTabView extends RefCounted {
    [x: string]: any;
    element = document.createElement('div');
    tabBar = document.createElement('div');
    tbody = document.createElement('tbody');
    button = document.createElement('button')
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
        // this.tabs = options.tabs;
        const {element, tabBar} = this;
        element.className = 'neuroglancer-annotation-geneTable-tab';
        tabBar.className = 'neuroglancer-tab-gene-view-bar';
        tabBar.innerHTML = 'Gene Table'
        element.appendChild(tabBar);
        this.element.appendChild(this.geneTableHead())
        this.element.appendChild(this.geneFiiter())
        this.initGeneTable()
    }
    private async initGeneTable(){
        const table = await this.geneTableList()
        removeChildren(this.listEle)
        removeChildren(this.pagenation)
        removeChildren(this.tbody)
        this.geneElement.appendChild(table.tableDom)
        this.totalPage = table.tablePage
        this.geneElement.appendChild(this.genePagenation())
        this.element.appendChild(this.geneElement);
        this.element.appendChild(this.geneTableReset())
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
        geneSortASC.classList.add('sort-caret', 'ascending', 'geneid')
        geneSortDESC.classList.add('sort-caret', 'descending', 'geneid')
        E10SortASC.classList.add('sort-caret', 'ascending', 'E10')
        E10SortDESC.classList.add('sort-caret', 'descending', 'E10')
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
            if( (event.target as Element).classList.contains('ascending')){
                TableHead.getElementsByTagName('i')[i].style.borderBottomColor = '#409eff'
            }else{
                TableHead.getElementsByTagName('i')[i].style.borderTopColor = '#409eff'
            }
            this.sortname = (event.target as Element).classList[2]
            this.isasc = (event.target as Element).classList[1] == 'ascending'
            this.initGeneTable()
            })
        }
        return TableHead
    }
    private geneFiiter(){
    const inputEle = document.createElement('input')
    inputEle.placeholder = 'filter data...'
    inputEle.addEventListener('change',(event: Event)=>{
        this.filterparam = (event.target as any).value
        this.initGeneTable()
    })
    return inputEle
    }
    async geneTableList():Promise<any>{
        let url = 'http://127.0.0.1:5000/test/annotation/genelist?pagesize=20';
        url = url + '&pagenum=' + this.pagenum;
        url = this.filterparam?url + '&filterparam=' + this.filterparam : url;
        url = this.sortname?url + '&sort={"name":"' + this.sortname + '","isAsc":' + this.isasc+'}' : url;
        this.listEle.classList.add('el-table')
        this.listEle.appendChild(this.tbody)
        var httpRequest = new XMLHttpRequest(); //第一步：建立所需的对象
        httpRequest.open('GET', url, true); //第二步：打开连接  将请求参数写在url中  ps:"./Ptest.php?name=test&nameone=testone"
        httpRequest.send(); //第三步：发送请求  将请求参数写在URL中
        let that = this
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState == 4 && httpRequest.status == 200) {
                var res = <any>JSON.parse(httpRequest.responseText) ; //获取到json字符串，还需解析
                if(res.code == 200){
                    that.totalPage = res.totalpage
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
                        const tdMIDCount = document.createElement('td')
                        const MIDCount = document.createElement('div')
                        MIDCount.classList.add('cell')
                        tdMIDCount.setAttribute('rowspan', '1')
                        tdMIDCount.setAttribute('colspan', '1')
                        MIDCount.innerText = item.MIDcount
                        MIDCount.setAttribute('value', item.gene)
                        const tdE10 = document.createElement('td')
                        const E10 = document.createElement('div')
                        E10.classList.add('cell')
                        tdE10.setAttribute('rowspan', '1')
                        tdE10.setAttribute('colspan', '1')
                        E10.innerText = item.E10.toFixed(2)
                        E10.setAttribute('value', item.gene)
                        tdCheckbox.appendChild(checkDiv)
                        checkDiv.appendChild(checkbox)
                        tdGene.appendChild(gene)
                        tdMIDCount.appendChild(MIDCount)
                        tdE10.appendChild(E10)
                        tr.appendChild(tdCheckbox)
                        tr.appendChild(tdGene)
                        tr.appendChild(tdMIDCount)
                        tr.appendChild(tdE10)
                        that.tbody.appendChild(tr)
                        that.listEle.appendChild(that.tbody)
                    })
                }
            }
        };
        return {tableDom: that.listEle, tablePage: that.totalPage}
    }
    private genePagenation(){
        const prevBtn = document.createElement('button')
        const pageDiv = document.createElement('div')
        const pageCurr = document.createElement('input')
        const pageTotal = document.createElement('p')
        const pageInner = document.createElement('p')
        const nextBtn = document.createElement('button')
        this.pagenation.classList.add('el-pagination')
        prevBtn.classList.add('btn-prev')
        prevBtn.innerText = '上一页'
        nextBtn.classList.add('btn-next')
        nextBtn.innerText = '下一页'
        prevBtn.type = 'button'
        nextBtn.type = 'button'
        pageCurr.setAttribute('value', this.pagenum.toString());
        pageTotal.innerText = this.totalPage
        pageInner.innerText = '/'
        pageDiv.classList.add('el-pager')
        this.pagenation.appendChild(prevBtn)
        this.pagenation.appendChild(pageDiv)
        this.pagenation.appendChild(nextBtn)
        pageDiv.appendChild(pageCurr)
        pageDiv.appendChild(pageInner)
        pageDiv.appendChild(pageTotal)
        prevBtn.addEventListener('click',()=>{
            if(this.pagenum > 1){
            this.pagenum = this.pagenum - 1;
            pageCurr.setAttribute('value', this.pagenum.toString())
            this.initGeneTable()
            }else{
            window.confirm('已经是第一页了')
            }
        })
        nextBtn.addEventListener('click',()=>{
            this.pagenum = this.pagenum + 1;
            pageCurr.setAttribute('value', this.pagenum.toString())
            this.initGeneTable()
        });
        pageCurr.addEventListener('change',(event:Event)=>{
            console.log(event)
            this.pagenum = (event.target as HTMLInputElement ).value
            this.initGeneTable()
        })
        return this.pagenation
    }
    geneTableReset(){
        this.button.classList.add('el-button','el-button--default','is-plain')
        this.button.innerHTML = `<span>RESET</span>`
        return this.button
    }
}