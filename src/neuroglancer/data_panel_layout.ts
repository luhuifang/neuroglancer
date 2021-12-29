/**
 * @license
 * Copyright 2016 Google Inc.
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

import 'neuroglancer/data_panel_layout.css';

import debounce from 'lodash/debounce';
import {ChunkManager} from 'neuroglancer/chunk_manager/frontend';
import {DisplayContext} from 'neuroglancer/display_context';
import {LayerManager, LayerSelectedValues, MouseSelectionState, SelectedLayerState, TrackableDataSelectionState} from 'neuroglancer/layer';
import * as L from 'neuroglancer/layout';
import {DisplayPose, LinkedOrientationState, LinkedPosition, linkedStateLegacyJsonView, LinkedZoomState, NavigationState, OrientationState, TrackableZoomInterface} from 'neuroglancer/navigation_state';
import {PerspectivePanel} from 'neuroglancer/perspective_view/panel';
import {RenderedDataPanel} from 'neuroglancer/rendered_data_panel';
import {RenderLayerRole} from 'neuroglancer/renderlayer';
import {SliceView} from 'neuroglancer/sliceview/frontend';
import {SliceViewerState, SliceViewPanel} from 'neuroglancer/sliceview/panel';
import {TrackableBoolean} from 'neuroglancer/trackable_boolean';
import {TrackableValue, WatchableSet, WatchableValueInterface} from 'neuroglancer/trackable_value';
import {TrackableRGB} from 'neuroglancer/util/color';
import {Borrowed, Owned, RefCounted} from 'neuroglancer/util/disposable';
import {removeChildren, removeFromParent} from 'neuroglancer/util/dom';
import {EventActionMap, registerActionListener} from 'neuroglancer/util/event_action_map';
import {quat} from 'neuroglancer/util/geom';
import {verifyObject, verifyObjectProperty, verifyPositiveInt} from 'neuroglancer/util/json';
import {NullarySignal} from 'neuroglancer/util/signal';
import {optionallyRestoreFromJsonMember, Trackable} from 'neuroglancer/util/trackable';
import {WatchableMap} from 'neuroglancer/util/watchable_map';
import {VisibilityPrioritySpecification} from 'neuroglancer/viewer_state';
import {DisplayDimensionsWidget} from 'neuroglancer/widget/display_dimensions_widget';
import {ScaleBarOptions} from 'neuroglancer/widget/scale_bar';
import { makeElement } from './ui/layer_gene_table_tab';
import { MessageBox } from './widget/message_box';
import { viewer } from 'src/main';
import { cancellableFetchSpecialOk } from './util/special_protocol_request';
import { responseJson } from './util/http_request';
export interface SliceViewViewerState {
  chunkManager: ChunkManager;
  navigationState: NavigationState;
  layerManager: LayerManager;
  wireFrame: WatchableValueInterface<boolean>;
}

export class InputEventBindings {
  perspectiveView = new EventActionMap();
  sliceView = new EventActionMap();
}

export interface ViewerUIState extends SliceViewViewerState, VisibilityPrioritySpecification {
  display: DisplayContext;
  mouseState: MouseSelectionState;
  perspectiveNavigationState: NavigationState;
  selectionDetailsState: TrackableDataSelectionState;
  showPerspectiveSliceViews: TrackableBoolean;
  showAxisLines: TrackableBoolean;
  wireFrame: TrackableBoolean;
  showScaleBar: TrackableBoolean;
  scaleBarOptions: TrackableValue<ScaleBarOptions>;
  visibleLayerRoles: WatchableSet<RenderLayerRole>;
  selectedLayer: SelectedLayerState;
  inputEventBindings: InputEventBindings;
  crossSectionBackgroundColor: TrackableRGB;
  perspectiveViewBackgroundColor: TrackableRGB;
}

export interface DataDisplayLayout extends RefCounted {
  rootElement: HTMLElement;
  container: DataPanelLayoutContainer;
}

type NamedAxes = 'xy'|'xz'|'yz';

const AXES_RELATIVE_ORIENTATION = new Map<NamedAxes, quat|undefined>([
  ['xy', undefined],
  ['xz', quat.rotateX(quat.create(), quat.create(), Math.PI / 2)],
  ['yz', quat.rotateY(quat.create(), quat.create(), Math.PI / 2)],
]);

const oneSquareSymbol = '◻';

const LAYOUT_SYMBOLS = new Map<string, string>([
  ['4panel', '◱'],
  ['3d', oneSquareSymbol],
]);

export function makeSliceView(viewerState: SliceViewViewerState, baseToSelf?: quat) {
  let navigationState: NavigationState;
  if (baseToSelf === undefined) {
    navigationState = viewerState.navigationState.addRef();
  } else {
    navigationState = new NavigationState(
        new DisplayPose(
            viewerState.navigationState.pose.position.addRef(),
            viewerState.navigationState.pose.displayDimensionRenderInfo.addRef(),
            OrientationState.makeRelative(
                viewerState.navigationState.pose.orientation, baseToSelf)),
        viewerState.navigationState.zoomFactor.addRef(),
        viewerState.navigationState.depthRange.addRef());
  }
  return new SliceView(
      viewerState.chunkManager, viewerState.layerManager, navigationState, viewerState.wireFrame);
}

export function makeNamedSliceView(viewerState: SliceViewViewerState, axes: NamedAxes) {
  return makeSliceView(viewerState, AXES_RELATIVE_ORIENTATION.get(axes)!);
}

export function makeOrthogonalSliceViews(viewerState: SliceViewViewerState) {
  return new Map<NamedAxes, SliceView>([
    ['xy', makeNamedSliceView(viewerState, 'xy')],
    ['xz', makeNamedSliceView(viewerState, 'xz')],
    ['yz', makeNamedSliceView(viewerState, 'yz')],
  ]);
}

export function getCommonViewerState(viewer: ViewerUIState) {
  return {
    crossSectionBackgroundColor: viewer.crossSectionBackgroundColor,
    perspectiveViewBackgroundColor: viewer.perspectiveViewBackgroundColor,
    selectionDetailsState: viewer.selectionDetailsState,
    mouseState: viewer.mouseState,
    layerManager: viewer.layerManager,
    showAxisLines: viewer.showAxisLines,
    wireFrame: viewer.wireFrame,
    visibleLayerRoles: viewer.visibleLayerRoles,
    selectedLayer: viewer.selectedLayer,
    visibility: viewer.visibility,
    scaleBarOptions: viewer.scaleBarOptions,
    layerSelectedValues: viewer.selectionDetailsState.layerSelectedValues
  };
}

function getCommonPerspectiveViewerState(container: DataPanelLayoutContainer) {
  const {viewer} = container;
  return {
    ...getCommonViewerState(viewer),
    navigationState: viewer.perspectiveNavigationState,
    inputEventMap: viewer.inputEventBindings.perspectiveView,
    orthographicProjection: container.specification.orthographicProjection,
    showScaleBar: viewer.showScaleBar,
    rpc: viewer.chunkManager.rpc!,
  };
}

function getCommonSliceViewerState(viewer: ViewerUIState) {
  return {
    ...getCommonViewerState(viewer),
    navigationState: viewer.navigationState,
    inputEventMap: viewer.inputEventBindings.sliceView,
  };
}

function addDisplayDimensionsWidget(layout: DataDisplayLayout, panel: RenderedDataPanel) {
  const {navigationState} = panel;
  panel.element.appendChild(
      layout
          .registerDisposer(new DisplayDimensionsWidget(
              navigationState.pose.displayDimensionRenderInfo.addRef(), navigationState.zoomFactor,
              navigationState.depthRange.addRef(), (panel instanceof SliceViewPanel) ? 'px' : 'vh'))
          .element);
}

function tools(layerSelectedValues: LayerSelectedValues, sliceView: SliceViewPanel){
  const lasso =  makeElement('button', ['lassoBtn'],{'isclicked':'false'});
  lasso.style.padding = '0';
  lasso.innerHTML = `<svg t="1639099443278" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1859" width="128" height="128"><path d="M669.12768 697.68704C616.55296 718.56384 556.90752 729.6 496.64 729.6c-60.26496 0-119.90784-11.03616-172.48512-31.9104-26.28352-10.43456-56.04608 2.40896-66.48064 28.68992-10.43456 26.28352 2.41152 56.04608 28.69248 66.48064C350.85056 818.46528 423.56224 832 496.64 832c73.08288 0 145.79712-13.53472 210.28096-39.1424 26.28096-10.43456 39.12448-40.19968 28.68992-66.4832-10.43712-26.2784-40.19712-39.13216-66.4832-28.68736zM629.31712 486.83264l208.16896 352.86784 29.49376-147.57376 134.1184-69.28896zM161.28 555.52c-48.07168 0-87.04 38.96832-87.04 87.04 0 40.064 27.07968 73.78432 63.92576 83.91424 1.57696 13.58336 1.01888 29.24288-5.81632 42.33728-8.50176 16.2816-27.1872 27.46624-55.53408 33.2416-20.78208 4.23168-34.19392 24.512-29.96224 45.29152 3.70688 18.19392 19.712 30.74304 37.58848 30.74304 2.53952 0 5.12-0.25344 7.7056-0.7808 64.91904-13.22496 94.71744-46.97088 108.28288-72.94976 16.6016-31.79264 17.19808-65.74336 13.376-92.40064C234.76992 696.064 248.32 670.8992 248.32 642.56c0-48.07168-38.96832-87.04-87.04-87.04z" p-id="1860" fill="#ffffff"></path><path d="M102.64832 545.50528c28.17024-2.46272 49.0112-27.29216 46.54848-55.4624A189.10208 189.10208 0 0 1 148.48 473.6c0-65.79712 34.4448-128.52992 96.98816-176.64C311.99488 245.78304 401.19808 217.6 496.64 217.6s184.64512 28.18304 251.17184 79.36C810.3552 345.07008 844.8 407.80288 844.8 473.6c0 8.25344-0.54528 16.5632-1.62048 24.69888-3.70432 28.03456 16.01536 53.76256 44.04992 57.46688 2.2784 0.30208 4.53632 0.448 6.77376 0.448 25.2928 0 47.29088-18.7392 50.69312-44.49792 1.66144-12.5696 2.50624-25.3952 2.50624-38.1184 0-98.31424-48.63744-189.87008-136.95232-257.8048C725.91872 150.9248 614.54336 115.2 496.64 115.2S267.36128 150.9248 183.03232 215.7952C94.71744 283.72992 46.08 375.28576 46.08 473.6c0 8.44288 0.3712 16.9728 1.10592 25.3568 2.46272 28.17024 27.32288 49.01632 55.4624 46.54848z" p-id="1861" fill="#ffffff"></path></svg>`
  lasso.addEventListener('click',()=>{
    isLasso(true, layerSelectedValues, sliceView);
    (document.getElementById('lassoCanvas') as HTMLElement).style.zIndex = '88';
    lasso.setAttribute('isclicked', 'true');
  })
  return lasso
}

function isLasso(value:boolean, layerSelectedValues: LayerSelectedValues, sliceView:SliceViewPanel ){
  console.log(layerSelectedValues)
  let canvas = document.createElement('canvas');
  canvas.setAttribute('width','82%');
  canvas.setAttribute('height','100%');
  let result:any = [];
  canvas.id = 'lassoCanvas';
  let offset = 0;
  var xreduce = 0;
  var yreduce  = 0;
  let lastParamBin:string = '';
  canvas.classList.add('lassoCanvas');
    document.getElementsByClassName('neuroglancer-rendered-data-panel')[0].appendChild(canvas)
    var w = canvas.width = window.innerWidth;
    var h = canvas.height = window.innerHeight;
    var ctx:CanvasRenderingContext2D|null = canvas.getContext('2d');
    var points:any = [];
    var drawNow = false;
    var paths:any = [];
    const draw = () => {
      paths = [];
      for (var i = 0; i < points.length; i++) {
        if (i == 0) {
          paths[i] = new Path2D();
        } else {
          paths[i] = new Path2D(paths[i - 1]);
        }
        paths[i].moveTo(points[i][0].x, points[i][0].y);
        for (var j = 1; j < points[i].length; j++) {
          paths[i].lineTo(points[i][j].x, points[i][j].y);
        }
      }
      ctx!.clearRect(0, 0, w, h);
      ctx!.fillStyle = "green";
      ctx!.fill(paths[paths.length - 1], 'evenodd')
      ctx!.setLineDash([5, 4, 3]);
      march();
      ctx!.lineDashOffset = offset;
      ctx!.stroke(paths[paths.length - 1]);
    }
    // 增加边缘闪动
  let march = () => {
    offset++;
    if (offset > 15) {
        offset = 0;
    }
    setTimeout(march, 20);
  };
  // 去重
  const removeRepeat2 = (arr:[]) => {
    const obj={};
    arr.forEach(item=> !obj[ item.toString() ] && (obj[item.toString()]=item));
    return Object.values(obj);
  };
  canvas.onmousedown = function (e) {
    drawNow = true;
    points.push([]);
    xreduce = e.clientX - e.offsetX;
    yreduce = e.clientY - e.offsetY;
    points[points.length - 1].push({ x: e.offsetX, y: e.offsetY , clientx: e.clientX, clienty: e.clientX});
    canvas.onmousemove = function (e) {
      if (drawNow) {
        sliceView.handleMouseMove(e.clientX, e.clientY);
        result.push([layerSelectedValues.mouseState.position[0],layerSelectedValues.mouseState.position[1]]);
        points[points.length - 1].push({ x: e.offsetX, y: e.offsetY , clientx: e.clientX, clienty: e.clientX});
        draw();
      }
    };
    canvas.onmouseup = function () {
      drawNow = false;
      getPosition(points);
      result.shift();
      result = removeRepeat2(result);
      (document.getElementById('lassoCanvas') as HTMLElement).style.zIndex = '-1';
      console.log(result)
      let message = showMessageBox('Run analysis', getMessageContent());
      document.getElementsByClassName('el-message-box__btns')[0].addEventListener('click', ()=>{
        submit();
        message.element.style.display = 'none';
        message.dispose();
      })
    };
};
  const modelArr = [{name: 'Export lasso data only'},{name: 'Export lasso data + run cellCluster analysis'},{name: 'Export all data only'},{name: 'Export all data + run cellCluster analysis'}]
  let getMessageContent = ()=>{
    const div = makeElement('div', ['el-message-box__container']);
    const title = makeElement('div', ['div'], {}, 'Mean MID counts: 3601.32. Mean genes: 993.48');
    const subDiv = makeElement('div', ['analysisConfig']);
    const subTitle = makeElement('div', ['subTitle'],{},'You can do');
    const Prefix = makeElement('h3', [], {}, 'Prefix of export file: ');
    const perfixInput = makeElement('input', ['perfix-input']);
    const preDiv = makeElement('div');
    preDiv.appendChild(Prefix);
    preDiv.appendChild(perfixInput);
    const selectTitle = makeElement('h3', [], {}, 'Select export model:');
    const selectOption = makeElement('div', ['selectOpt']);
    for(let i = 0; i < modelArr.length; i++){
      var radio = makeElement('input', [],{'type':'radio', 'name': 'exportModel', 'value': i}) as HTMLInputElement;
      var label = makeElement('label', [], {}, modelArr[i].name);
      var ele = makeElement('div',[],{})
      if(i === 0){
        radio.setAttribute('checked','checked')
      }
      ele.appendChild(radio);
      ele.appendChild(label)
      selectOption.appendChild(ele)
    }
    let binlist = viewer.dataSource.subsources[0].subsource.annotation?.metadata?.binlist;
    const seleDiv = makeElement('div');
    const seleTitle = makeElement('h3', [], {}, 'Select bin size: ');
    const selectBin = document.createElement('select');
    selectBin.classList.add('lassoBinSize');
    let bin = viewer.state.toJSON().layers[0].source.split('/');
    lastParamBin = bin.splice(bin.length - 1, 1)
    for(let i = 0; i < binlist.length; i++){
      selectBin.options.add(new Option(binlist[i], binlist[i],false, binlist[i] === lastParamBin[0]?true:false) );
    }
    seleDiv.appendChild(seleTitle);
    seleDiv.appendChild(selectBin);
    div.appendChild(title);
    div.appendChild(subDiv);
    div.appendChild(subTitle);
    div.appendChild(preDiv);
    div.appendChild(selectTitle);
    div.appendChild(selectOption);
    div.appendChild(seleDiv);
    return div
  }
  // 确认套索
  let submit = async ():Promise<void>=>{
    let radio = null
    var obj = document.getElementsByName("exportModel");
    for (var i = 0; i < obj.length; i++) { //遍历Radio 
      console.log(obj[i])
      if ( (obj[i] as HTMLInputElement).checked) {
        radio = (obj[i] as HTMLInputElement).value;                   
      }
    };
    let binsize = (document.getElementsByClassName("lassoBinSize")[0] as HTMLInputElement)?.value.substring(3);
    let prefix = (document.getElementsByClassName("perfix-input")[0] as HTMLInputElement)?.value;
    let host = viewer.state.toJSON().layers[0].source.split('/');
    let url = host[2] + '//' + host[4] + '/' + host[5] +'/task/lasso';
    var data = new FormData();
    data.append('curr_bin',lastParamBin[0].substring(3));
    data.append('export_bin',binsize);
    data.append('points',result);
    data.append('prefix',prefix);
    let json = {
      method: 'post',
      body: data
    }
    let req = async (): Promise<any> =>{
      return await cancellableFetchSpecialOk(undefined, `${url}`, json, responseJson);
    };
    let res = await req();
    if( res?.code === 200 ){
      console.log('cg')
    }else{

    }
    ctx!.clearRect(0, 0, w, h);
    document.removeChild(canvas);
    console.log(radio, binsize, prefix)
  }
  // 获取spot坐标
  let getPosition = (arr:any[])=>{
    let newarr = arr.flat();
    var x = newarr.sort((a, b)=>{ return a.x - b.x });
    var xMin = x[0].x;
    var xMax = x[x.length - 1].x;
    var y = newarr.sort((a, b)=>{ return a.y - b.y });
    var yMin = y[0].y;
    var yMax = y[y.length - 1].y;
    ctx!.rect(xMin, yMin, xMax - xMin, yMax- yMin);
    ctx!.stroke();
    ctx!.strokeStyle = '#000';
    for(let i = xMin; i < xMax; i++){
      for(let j = yMin; j < yMax; j++){
        if(ctx!.isPointInPath(i, j, 'evenodd') && ctx!.getImageData(i, j, 1, 1).data[1] == 128){
          sliceView.handleMouseMove(i+xreduce, j+yreduce);
          sliceView.pickRequests[0].glWindowX = i+xreduce;
          sliceView.pickRequests[0].glWindowY = j+yreduce;
          sliceView.issuePickRequest(i+xreduce, j+yreduce)
          result.push([layerSelectedValues.mouseState.position[0],layerSelectedValues.mouseState.position[1]]);
        }else{
        }
      }
    };
  }
  console.log(result)
}

function showMessageBox(title: string, content:Node){
  let message = new MessageBox(title, content);
  message.element.style.display = 'block';
  return message
}

function registerRelatedLayouts(
    layout: DataDisplayLayout, panel: RenderedDataPanel, relatedLayouts: string[], extElemet?:HTMLElement) {
  const controls = document.createElement('div');
  controls.className = 'neuroglancer-data-panel-layout-controls';
  layout.registerDisposer(() => removeFromParent(controls));
  for (let i = 0; i < 2; ++i) {
    const relatedLayout = relatedLayouts[Math.min(relatedLayouts.length - 1, i)];
    layout.registerDisposer(registerActionListener(
        panel.element, i === 0 ? 'toggle-layout' : 'toggle-layout-alternative', (event: Event) => {
          layout.container.name = relatedLayout;
          event.stopPropagation();
        }));
  }
  for (const relatedLayout of relatedLayouts) {
    const button = document.createElement('button');
    const innerDiv = document.createElement('div');
    button.appendChild(innerDiv);
    innerDiv.textContent = LAYOUT_SYMBOLS.get(relatedLayout)!;
    button.title = `Switch to ${relatedLayout} layout.`;
    button.addEventListener('click', () => {
      layout.container.name = relatedLayout;
      if(layout.container.name === 'xy'){
        (document.getElementsByClassName('colorBarScale')[0] as HTMLElement).style.display = 'block';
        let c = document.createElement('canvas');
        c.id = 'lassoCanvas';
        document.getElementsByClassName('neuroglancer-rendered-data-panel')[0].appendChild(c)
      }
    });
    controls.appendChild(button);
  }
  extElemet ? controls.appendChild(extElemet):'';
  panel.element.appendChild(controls);
}

function makeSliceViewFromSpecification(
    viewer: SliceViewViewerState, specification: Borrowed<CrossSectionSpecification>) {
  const sliceView = new SliceView(
      viewer.chunkManager, viewer.layerManager, specification.navigationState.addRef(),
      viewer.wireFrame);
  const updateViewportSize = () => {
    const {width: {value: width}, height: {value: height}} = specification;
    sliceView.projectionParameters.setViewport({
      width,
      height,
      logicalWidth: width,
      logicalHeight: height,
      visibleLeftFraction: 0,
      visibleTopFraction: 0,
      visibleWidthFraction: 1,
      visibleHeightFraction: 1
    });
  };
  sliceView.registerDisposer(specification.width.changed.add(updateViewportSize));
  sliceView.registerDisposer(specification.height.changed.add(updateViewportSize));
  updateViewportSize();
  return sliceView;
}

function addUnconditionalSliceViews(
    viewer: SliceViewViewerState, panel: PerspectivePanel,
    crossSections: Borrowed<CrossSectionSpecificationMap>) {
  const previouslyAdded = new Map<Borrowed<CrossSectionSpecification>, Borrowed<SliceView>>();
  const update = () => {
    const currentCrossSections = new Set<Borrowed<CrossSectionSpecification>>();
    // Add missing cross sections.
    for (const crossSection of crossSections.values()) {
      currentCrossSections.add(crossSection);
      if (previouslyAdded.has(crossSection)) {
        continue;
      }
      const sliceView = makeSliceViewFromSpecification(viewer, crossSection);
      panel.sliceViews.set(sliceView, true);
      previouslyAdded.set(crossSection, sliceView);
    }
    // Remove extra cross sections.
    for (const [crossSection, sliceView] of previouslyAdded) {
      if (currentCrossSections.has(crossSection)) {
        continue;
      }
      panel.sliceViews.delete(sliceView);
    }
  };
  update();
}

export class FourPanelLayout extends RefCounted {
  constructor(
      public container: DataPanelLayoutContainer, public rootElement: HTMLElement,
      public viewer: ViewerUIState, crossSections: Borrowed<CrossSectionSpecificationMap>) {
    super();

    let sliceViews = makeOrthogonalSliceViews(viewer);
    let {display} = viewer;

    const perspectiveViewerState = {
      ...getCommonPerspectiveViewerState(container),
      showSliceViews: viewer.showPerspectiveSliceViews,
      showSliceViewsCheckbox: true,
    };

    const sliceViewerState = {
      ...getCommonSliceViewerState(viewer),
      showScaleBar: viewer.showScaleBar,
    };
    const sliceViewerStateWithoutScaleBar = {
      ...getCommonSliceViewerState(viewer),
      showScaleBar: new TrackableBoolean(false, false),
    };

    const makeSliceViewPanel =
        (axes: NamedAxes, element: HTMLElement, state: SliceViewerState,
         displayDimensionsWidget: boolean, extElement?: HTMLElement) => {
          const panel = this.registerDisposer(
              new SliceViewPanel(display, element, sliceViews.get(axes)!, state));
          if (displayDimensionsWidget) {
            addDisplayDimensionsWidget(this, panel);
          }
          if(axes === 'xy'){
            tools(viewer.selectionDetailsState.layerSelectedValues, panel) 
          }
          registerRelatedLayouts(this, panel, [axes, `${axes}-3d`], extElement);
          return panel;
        };
    let mainDisplayContents = [
      L.withFlex(1, L.box('column', [
        L.withFlex(1, L.box('row', [
          L.withFlex(1, element => {
            // 
            makeSliceViewPanel('xy', element, sliceViewerState, true);
          }),
          L.withFlex(1, element => {
            makeSliceViewPanel('xz', element, sliceViewerStateWithoutScaleBar, false);
          })
        ])),
        L.withFlex(1, L.box('row', [
          L.withFlex(1, element => {
            let panel = this.registerDisposer(
                new PerspectivePanel(display, element, perspectiveViewerState));
            for (let sliceView of sliceViews.values()) {
              panel.sliceViews.set(sliceView.addRef(), false);
            }
            addDisplayDimensionsWidget(this, panel);
            addUnconditionalSliceViews(viewer, panel, crossSections);
            registerRelatedLayouts(this, panel, ['3d']);
          }),
          L.withFlex(1, element => {
            makeSliceViewPanel('yz', element, sliceViewerStateWithoutScaleBar, false);
          })
        ])),
      ]))
    ];
    L.box('row', mainDisplayContents)(rootElement);
  }

  disposed() {
    removeChildren(this.rootElement);
    super.disposed();
  }
}

export class SliceViewPerspectiveTwoPanelLayout extends RefCounted {
  constructor(
      public container: DataPanelLayoutContainer, public rootElement: HTMLElement,
      public viewer: ViewerUIState, public direction: 'row'|'column', axes: NamedAxes,
      crossSections: Borrowed<CrossSectionSpecificationMap>) {
    super();

    let sliceView = makeNamedSliceView(viewer, axes);
    let {display} = viewer;

    const perspectiveViewerState = {
      ...getCommonPerspectiveViewerState(container),
      showSliceViews: viewer.showPerspectiveSliceViews,
      showSliceViewsCheckbox: true,
    };

    const sliceViewerState = {
      ...getCommonSliceViewerState(viewer),
      showScaleBar: viewer.showScaleBar,
    };

    L.withFlex(1, L.box(direction, [
      L.withFlex(
          1,
          element => {
            const panel = this.registerDisposer(
                new SliceViewPanel(display, element, sliceView, sliceViewerState));
            addDisplayDimensionsWidget(this, panel);
            registerRelatedLayouts(this, panel, [axes, '4panel']);
          }),
      L.withFlex(
          1,
          element => {
            let panel = this.registerDisposer(
                new PerspectivePanel(display, element, perspectiveViewerState));
            panel.sliceViews.set(sliceView.addRef(), false);
            addUnconditionalSliceViews(viewer, panel, crossSections);
            addDisplayDimensionsWidget(this, panel);
            registerRelatedLayouts(this, panel, ['3d', '4panel']);
          }),
    ]))(rootElement);
  }

  disposed() {
    removeChildren(this.rootElement);
    super.disposed();
  }
}

export class SinglePanelLayout extends RefCounted {
  constructor(
      public container: DataPanelLayoutContainer, public rootElement: HTMLElement,
      public viewer: ViewerUIState, axes: NamedAxes) {
    super();
    let sliceView = makeNamedSliceView(viewer, axes);
    const sliceViewerState = {
      ...getCommonSliceViewerState(viewer),
      showScaleBar: viewer.showScaleBar,
    };

    L.box('row', [L.withFlex(1, element => {
            const panel = this.registerDisposer(
                new SliceViewPanel(viewer.display, element, sliceView, sliceViewerState));
            addDisplayDimensionsWidget(this, panel);
            registerRelatedLayouts(this, panel, ['4panel', `${axes}-3d`], tools(viewer.selectionDetailsState.layerSelectedValues, panel));
          })])(rootElement);
  }

  disposed() {
    removeChildren(this.rootElement);
    super.disposed();
  }
}

export class SinglePerspectiveLayout extends RefCounted {
  constructor(
      public container: DataPanelLayoutContainer, public rootElement: HTMLElement,
      public viewer: ViewerUIState, crossSections: Borrowed<CrossSectionSpecificationMap>) {
    super();
    let perspectiveViewerState = {
      ...getCommonPerspectiveViewerState(container),
      showSliceViews: new TrackableBoolean(false, false),
    };


    L.box('row', [L.withFlex(1, element => {
            const panel = this.registerDisposer(
                new PerspectivePanel(viewer.display, element, perspectiveViewerState));
            addUnconditionalSliceViews(viewer, panel, crossSections);
            addDisplayDimensionsWidget(this, panel);
            registerRelatedLayouts(this, panel, ['4panel']);
          })])(rootElement);
  }

  disposed() {
    removeChildren(this.rootElement);
    super.disposed();
  }
}

export const LAYOUTS = new Map<string, {
  factory:
      (container: DataPanelLayoutContainer, element: HTMLElement, viewer: ViewerUIState,
       crossSections: Borrowed<CrossSectionSpecificationMap>) => DataDisplayLayout
}>(
    [
      [
        '4panel', {
          factory: (container, element, viewer, crossSections) =>
              new FourPanelLayout(container, element, viewer, crossSections)
        }
      ],
      [
        '3d', {
          factory: (container, element, viewer, crossSections) =>
              new SinglePerspectiveLayout(container, element, viewer, crossSections)
        }
      ],
    ],
);

for (const axes of AXES_RELATIVE_ORIENTATION.keys()) {
  LAYOUTS.set(axes, {
    factory: (container, element, viewer) =>
        new SinglePanelLayout(container, element, viewer, <NamedAxes>axes)
  });
  const splitLayout = `${axes}-3d`;
  LAYOUT_SYMBOLS.set(axes, oneSquareSymbol);
  LAYOUT_SYMBOLS.set(splitLayout, '◫');
  LAYOUTS.set(splitLayout, {
    factory: (container, element, viewer, crossSections) => new SliceViewPerspectiveTwoPanelLayout(
        container, element, viewer, 'row', <NamedAxes>axes, crossSections)
  });
}

export function getLayoutByName(obj: any) {
  let layout = LAYOUTS.get(obj);
  if (layout === undefined) {
    throw new Error(`Invalid layout name: ${JSON.stringify(obj)}.`);
  }
  return layout;
}

export function validateLayoutName(obj: any) {
  getLayoutByName(obj);
  return <string>obj;
}

export class CrossSectionSpecification extends RefCounted implements Trackable {
  width = new TrackableValue<number>(1000, verifyPositiveInt);
  height = new TrackableValue<number>(1000, verifyPositiveInt);
  position: LinkedPosition;
  orientation: LinkedOrientationState;
  scale: LinkedZoomState<TrackableZoomInterface>;
  navigationState: NavigationState;
  changed = new NullarySignal();
  constructor(parent: Borrowed<NavigationState>) {
    super();
    this.position = new LinkedPosition(parent.position.addRef());
    this.position.changed.add(this.changed.dispatch);
    this.orientation = new LinkedOrientationState(parent.pose.orientation.addRef());
    this.orientation.changed.add(this.changed.dispatch);
    this.width.changed.add(this.changed.dispatch);
    this.height.changed.add(this.changed.dispatch);
    this.scale = new LinkedZoomState(
        parent.zoomFactor.addRef(), parent.zoomFactor.displayDimensionRenderInfo.addRef());
    this.scale.changed.add(this.changed.dispatch);
    this.navigationState = this.registerDisposer(new NavigationState(
        new DisplayPose(
            this.position.value, parent.pose.displayDimensionRenderInfo.addRef(),
            this.orientation.value),
        this.scale.value, parent.depthRange.addRef()));
  }

  restoreState(obj: any) {
    verifyObject(obj);
    optionallyRestoreFromJsonMember(obj, 'width', this.width);
    optionallyRestoreFromJsonMember(obj, 'height', this.height);
    optionallyRestoreFromJsonMember(obj, 'position', linkedStateLegacyJsonView(this.position));
    optionallyRestoreFromJsonMember(obj, 'orientation', this.orientation);
    optionallyRestoreFromJsonMember(obj, 'scale', this.scale);
    optionallyRestoreFromJsonMember(obj, 'zoom', linkedStateLegacyJsonView(this.scale));
  }

  reset() {
    this.width.reset();
    this.height.reset();
    this.position.reset();
    this.orientation.reset();
    this.scale.reset();
  }

  toJSON() {
    return {
      width: this.width.toJSON(),
      height: this.height.toJSON(),
      position: this.position.toJSON(),
      orientation: this.orientation.toJSON(),
      scale: this.scale.toJSON(),
    };
  }
}

export class CrossSectionSpecificationMap extends WatchableMap<string, CrossSectionSpecification> {
  constructor(private parentNavigationState: Owned<NavigationState>) {
    super(
        (context, spec) => context.registerDisposer(
            context.registerDisposer(spec).changed.add(this.changed.dispatch)),
    );
    this.registerDisposer(parentNavigationState);
  }

  restoreState(obj: any) {
    verifyObject(obj);
    for (const key of Object.keys(obj)) {
      const state = new CrossSectionSpecification(this.parentNavigationState);
      try {
        this.set(key, state.addRef());
        state.restoreState(obj[key]);
      } finally {
        state.dispose();
      }
    }
  }

  reset() {
    this.clear();
  }

  toJSON() {
    if (this.size === 0) return undefined;
    const obj: {[key: string]: any} = {};
    for (const [k, v] of this) {
      obj[k] = v.toJSON();
    }
    return obj;
  }
}

export class DataPanelLayoutSpecification extends RefCounted implements Trackable {
  changed = new NullarySignal();
  type: TrackableValue<string>;
  crossSections: CrossSectionSpecificationMap;
  orthographicProjection = new TrackableBoolean(false);

  constructor(parentNavigationState: Owned<NavigationState>, defaultLayout: string) {
    super();
    this.type = new TrackableValue<string>(defaultLayout, validateLayoutName);
    this.type.changed.add(this.changed.dispatch);
    this.crossSections =
        this.registerDisposer(new CrossSectionSpecificationMap(parentNavigationState.addRef()));
    this.crossSections.changed.add(this.changed.dispatch);
    this.orthographicProjection.changed.add(this.changed.dispatch);
    this.registerDisposer(parentNavigationState);
  }

  reset() {
    this.crossSections.clear();
    this.orthographicProjection.reset();
    this.type.reset();
  }

  restoreState(obj: any) {
    this.crossSections.clear();
    this.orthographicProjection.reset();
    if (typeof obj === 'string') {
      this.type.restoreState(obj);
    } else {
      verifyObject(obj);
      verifyObjectProperty(obj, 'type', x => this.type.restoreState(x));
      verifyObjectProperty(
          obj, 'orthographicProjection', x => this.orthographicProjection.restoreState(x));
      verifyObjectProperty(
          obj, 'crossSections', x => x !== undefined && this.crossSections.restoreState(x));
    }
  }

  toJSON() {
    const {type, crossSections, orthographicProjection} = this;
    const orthographicProjectionJson = orthographicProjection.toJSON();
    if (crossSections.size === 0 && orthographicProjectionJson === undefined) {
      return type.value;
    }
    return {
      type: type.value,
      crossSections: crossSections.toJSON(),
      orthographicProjection: orthographicProjectionJson,
    };
  }
}

export class DataPanelLayoutContainer extends RefCounted {
  element = document.createElement('div');
  specification: Owned<DataPanelLayoutSpecification>;

  private layout: DataDisplayLayout|undefined;

  get name() {
    return this.specification.type.value;
  }
  set name(value: string) {
    this.specification.type.value = value;
  }

  constructor(public viewer: ViewerUIState, defaultLayout: string) {
    super();
    this.specification = this.registerDisposer(
        new DataPanelLayoutSpecification(this.viewer.navigationState.addRef(), defaultLayout));
    this.element.style.flex = '1';
    const scheduleUpdateLayout = this.registerCancellable(debounce(() => this.updateLayout(), 0));
    this.specification.type.changed.add(scheduleUpdateLayout);

    registerActionListener(
        this.element, 'toggle-orthographic-projection',
        () => this.specification.orthographicProjection.toggle());

    // Ensure the layout is updated before drawing begins to avoid flicker.
    this.registerDisposer(
        this.viewer.display.updateStarted.add(() => scheduleUpdateLayout.flush()));
    scheduleUpdateLayout();
  }
  get changed() {
    return this.specification.changed;
  }
  toJSON() {
    return this.specification.toJSON();
  }
  restoreState(obj: any) {
    this.specification.restoreState(obj);
  }
  reset() {
    this.specification.reset();
  }
  private disposeLayout() {
    let {layout} = this;
    if (layout !== undefined) {
      layout.dispose();
      this.layout = undefined;
    }
  }
  private updateLayout() {
    this.disposeLayout();
    this.layout = getLayoutByName(this.name).factory(
        this, this.element, this.viewer, this.specification.crossSections);
  }
  disposed() {
    this.disposeLayout();
    super.disposed();
  }
}