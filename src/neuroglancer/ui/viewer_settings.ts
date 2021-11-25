/**
 * @license
 * Copyright 2021 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './viewer_settings.css';
import './layer_gene_table_tab.css';

import {TrackableBooleanCheckbox} from 'neuroglancer/trackable_boolean';
import {TrackableValue, WatchableValueInterface} from 'neuroglancer/trackable_value';
import {SidePanel, SidePanelManager} from 'neuroglancer/ui/side_panel';
import {DEFAULT_SIDE_PANEL_LOCATION, SidePanelLocation, TrackableSidePanelLocation} from 'neuroglancer/ui/side_panel_location';
import {vec3} from 'neuroglancer/util/geom';
import {emptyToUndefined} from 'neuroglancer/util/json';
import {Viewer} from 'neuroglancer/viewer';
import {ColorWidget} from 'neuroglancer/widget/color';
import {NumberInputWidget} from 'neuroglancer/widget/number_input_widget';
import {TextInputWidget} from 'neuroglancer/widget/text_input';
import { removeChildren } from '../util/dom';

const DEFAULT_SETTINGS_PANEL_LOCATION: SidePanelLocation = {
  ...DEFAULT_SIDE_PANEL_LOCATION,
  side: 'left',
  row: 2,
  visible: true
};

export class ViewerSettingsPanelState {
  location = new TrackableSidePanelLocation(DEFAULT_SETTINGS_PANEL_LOCATION);
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

export class geneTable extends SidePanel {
  constructor(sidePanelManager: SidePanelManager, state: ViewerSettingsPanelState, viewer: Viewer) {
    super(sidePanelManager, state.location);
    this.addTitleBar({title: 'Settings'});

    const body = document.createElement('div');
    body.classList.add('neuroglancer-settings-body');

    let scroll = document.createElement('div');
    scroll.classList.add('neuroglancer-settings-scroll-container');
    body.appendChild(scroll);
    this.addBody(body);

    {
      const titleWidget = this.registerDisposer(new TextInputWidget(viewer.title));
      titleWidget.element.placeholder = 'Title';
      titleWidget.element.classList.add('neuroglancer-settings-title');
      scroll.appendChild(titleWidget.element);
    }

    const addLimitWidget = (label: string, limit: TrackableValue<number>) => {
      const widget = this.registerDisposer(new NumberInputWidget(limit, {label}));
      widget.element.classList.add('neuroglancer-settings-limit-widget');
      scroll.appendChild(widget.element);
    };
    addLimitWidget('GPU memory limit', viewer.chunkQueueManager.capacities.gpuMemory.sizeLimit);
    addLimitWidget(
        'System memory limit', viewer.chunkQueueManager.capacities.systemMemory.sizeLimit);
    addLimitWidget(
        'Concurrent chunk requests', viewer.chunkQueueManager.capacities.download.itemLimit);

    const addCheckbox = (label: string, value: WatchableValueInterface<boolean>) => {
      const labelElement = document.createElement('label');
      labelElement.textContent = label;
      const checkbox = this.registerDisposer(new TrackableBooleanCheckbox(value));
      labelElement.appendChild(checkbox.element);
      scroll.appendChild(labelElement);
    };
    addCheckbox('Show axis lines', viewer.showAxisLines);
    addCheckbox('Show scale bar', viewer.showScaleBar);
    addCheckbox('Show cross sections in 3-d', viewer.showPerspectiveSliceViews);
    addCheckbox('Show default annotations', viewer.showDefaultAnnotations);
    addCheckbox('Show chunk statistics', viewer.statisticsDisplayState.location.watchableVisible);
    addCheckbox('Wire frame rendering', viewer.wireFrame);
    addCheckbox('Enable prefetching', viewer.chunkQueueManager.enablePrefetch);

    const addColor = (label: string, value: WatchableValueInterface<vec3>) => {
      const labelElement = document.createElement('label');
      labelElement.textContent = label;
      const widget = this.registerDisposer(new ColorWidget(value));
      labelElement.appendChild(widget.element);
      scroll.appendChild(labelElement);
    };

    addColor('Cross-section background', viewer.crossSectionBackgroundColor);
    addColor('Projection background', viewer.perspectiveViewBackgroundColor);
  }
}

export class ViewerSettingsPanel extends SidePanel {
  [x: string]: any;
  pagenum = 1;
  sortname:any;
  isasc:any;
  filterparam:any;
  geneElement = document.createElement('div');
  listEle = document.createElement('table');
  pagenation = document.createElement('div');
  totalPage:any;
  // urlInput = new SourceUrlAutocomplete(this.ViewerSettingsPanel);
  constructor(sidePanelManager: SidePanelManager, state: ViewerSettingsPanelState, viewer: Viewer) {
    super(sidePanelManager, state.location)
    this.addTitleBar({title: 'Gene Table'});
    this.geneElement.classList.add('neuroglancer-annotation-geneTable-tab');
    this.geneElement.appendChild(this.geneTableHead())
    this.geneElement.appendChild(this.geneFiiter())
    this.initGeneTable()
  }
  private async initGeneTable(){
    removeChildren(this.listEle)
    removeChildren(this.pagenation)
    const table = await this.geneTableList()
    this.geneElement.appendChild(table.tableDom)
    this.totalPage = table.tablePage
    this.geneElement.appendChild(this.genePagenation())
    this.addBody(this.geneElement);
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
    const tbody = document.createElement('tbody')
    this.listEle.appendChild(tbody)
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
            tdGene.addEventListener('click',(event: Event)=>{
              console.log(event)
              let inputValue = (document.getElementsByClassName('neuroglancer-multiline-autocomplete-input')[0] as HTMLInputElement).innerText?.split('/');
              // let inputValue = 'precomputed://http://127.0.0.1:5000/test/annotation/dnb/bin100'.split('/');
              inputValue.splice(inputValue.indexOf('annotation') + 1, 1, item.gene)
              let lastParam = inputValue.join('/')
              // urlInput.setValueAndSelection(lastParam)
              // let explicit = true;
              // urlInput.disableCompletion();
              // urlInput.hideCompletions();
              // urlInput.onCommit.dispatch(lastParam, explicit);
            })
            gene.innerText = item.gene
            const tdMIDCount = document.createElement('td')
            const MIDCount = document.createElement('div')
            MIDCount.classList.add('cell')
            tdMIDCount.setAttribute('rowspan', '1')
            tdMIDCount.setAttribute('colspan', '1')
            MIDCount.innerText = item.MIDcount
            const tdE10 = document.createElement('td')
            const E10 = document.createElement('div')
            E10.classList.add('cell')
            tdE10.setAttribute('rowspan', '1')
            tdE10.setAttribute('colspan', '1')
            E10.innerText = item.E10.toFixed(2)
            tdCheckbox.appendChild(checkDiv)
            checkDiv.appendChild(checkbox)
            tdGene.appendChild(gene)
            tdMIDCount.appendChild(MIDCount)
            tdE10.appendChild(E10)
            tr.appendChild(tdCheckbox)
            tr.appendChild(tdGene)
            tr.appendChild(tdMIDCount)
            tr.appendChild(tdE10)
            tbody.appendChild(tr)
            that.listEle.appendChild(tbody)
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
    })
    return this.pagenation
  }
}
