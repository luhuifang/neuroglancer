/**
 * @license
 * Copyright 2019 Google Inc.
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

/**
 * @file Tab for showing layer data sources and coordinate transforms.
 */

import './layer_data_sources_tab.css';

import {LocalDataSource} from 'neuroglancer/datasource';
import {changeLayerName, changeLayerType, NewUserLayer, UserLayer, UserLayerConstructor} from 'neuroglancer/layer';
import {LayerDataSource, LoadedDataSubsource, LoadedLayerDataSource} from 'neuroglancer/layer_data_source';
import {MeshSource, MultiscaleMeshSource} from 'neuroglancer/mesh/frontend';
import {SkeletonSource} from 'neuroglancer/skeleton/frontend';
import {MultiscaleVolumeChunkSource} from 'neuroglancer/sliceview/volume/frontend';
import {TrackableBooleanCheckbox} from 'neuroglancer/trackable_boolean';
import {WatchableValue, WatchableValueInterface} from 'neuroglancer/trackable_value';
import {animationFrameDebounce, DebouncedFunction} from 'neuroglancer/util/animation_frame_debounce';
import {CancellationToken} from 'neuroglancer/util/cancellation';
import {DataType} from 'neuroglancer/util/data_type';
import {Borrowed, RefCounted} from 'neuroglancer/util/disposable';
import {removeChildren, removeFromParent, updateChildren} from 'neuroglancer/util/dom';
import {MessageList, MessageSeverity} from 'neuroglancer/util/message_list';
import {makeAddButton} from 'neuroglancer/widget/add_button';
import {CoordinateSpaceTransformWidget} from 'neuroglancer/widget/coordinate_transform';
import {AutocompleteTextInput, makeCompletionElementWithDescription} from 'neuroglancer/widget/multiline_autocomplete';
import {Tab} from 'neuroglancer/widget/tab_view';
import { makeElement } from './layer_gene_table_tab';
import { viewer } from 'src/main';

export class SourceUrlAutocomplete extends AutocompleteTextInput {
  dataSourceView: DataSourceView;
  dirty: WatchableValueInterface<boolean>;
  constructor(dataSourceView: DataSourceView) {
    const {manager} = dataSourceView.source.layer;
    const sourceCompleter = (value: string, cancellationToken: CancellationToken) =>
        manager.dataSourceProviderRegistry
            .completeUrl({url: value, chunkManager: manager.chunkManager, cancellationToken})
            .then(originalResult => ({
                    completions: originalResult.completions,
                    makeElement: makeCompletionElementWithDescription,
                    offset: originalResult.offset,
                    showSingleResult: true,
                  }));
    super({completer: sourceCompleter, delay: 0});
    this.placeholder = 'Data source URL';
    this.dataSourceView = dataSourceView;
    this.element.classList.add('neuroglancer-layer-data-source-url-input');
    this.dirty = new WatchableValue(false);
    const updateDirty = (value: string) => {
      if (value !== this.dataSourceView.source.spec.url) {
        this.dirty.value = true;
      }
    };
    updateDirty('');
    this.onInput.add(updateDirty);
  }

  cancel() {
    this.value = this.dataSourceView.source.spec.url;
    this.dirty.value = false;
    this.inputElement.blur();
    return true;
  }
}

export class MessagesView extends RefCounted {
  element = document.createElement('ul');
  generation = -1;

  constructor(public model: MessageList) {
    super();
    this.element.classList.add('neuroglancer-layer-data-sources-source-messages');
    const debouncedUpdateView =
        this.registerCancellable(animationFrameDebounce(() => this.updateView()));
    this.registerDisposer(model.changed.add(debouncedUpdateView));
    this.registerDisposer(() => removeFromParent(this.element));
    this.updateView();
  }

  updateView() {
    const {model} = this;
    const generation = model.changed.count;
    if (generation === this.generation) return;
    this.generation = generation;
    const {element} = this;
    removeChildren(element);
    const seen = new Set<string>();
    for (const message of model) {
      const key = `${message.severity} ${message.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const li = document.createElement('li');
      element.appendChild(li);
      li.classList.add('neuroglancer-message');
      li.classList.add(`neuroglancer-message-${MessageSeverity[message.severity]}`);
      li.textContent = message.message;
    }
  }
}

export class DataSourceSubsourceView extends RefCounted {
  element = document.createElement('div');

  constructor(loadedSource: LoadedLayerDataSource, public loadedSubsource: LoadedDataSubsource) {
    super();
    const {element} = this;
    element.classList.add('neuroglancer-layer-data-source-subsource');
    const sourceInfoLine = document.createElement('label');
    const sourceType = document.createElement('span');
    const updateActiveAttribute = () => {
      sourceInfoLine.dataset.isActive =
          (loadedSubsource.activated !== undefined || !loadedSubsource.enabled).toString();
    };
    updateActiveAttribute();
    this.registerDisposer(loadedSubsource.isActiveChanged.add(updateActiveAttribute));
    this.registerDisposer(loadedSource.enabledSubsourcesChanged.add(updateActiveAttribute));
    const enabledCheckbox = this.registerDisposer(new TrackableBooleanCheckbox({
      get value() {
        return loadedSubsource.enabled;
      },
      set value(value: boolean) {
        loadedSubsource.enabled = value;
        loadedSource.enableDefaultSubsources = false;
        loadedSource.enabledSubsourcesChanged.dispatch();
      },
      changed: loadedSource.enabledSubsourcesChanged,
    }));
    sourceInfoLine.classList.add('neuroglancer-layer-data-sources-info-line');
    sourceInfoLine.appendChild(enabledCheckbox.element);

    const sourceId = document.createElement('span');
    sourceId.classList.add('neuroglancer-layer-data-sources-source-id');
    const {id} = loadedSubsource.subsourceEntry;
    if (id !== 'default') {
      sourceId.textContent = id;
    }
    sourceInfoLine.appendChild(sourceId);
    sourceType.classList.add('neuroglancer-layer-data-sources-source-type');
    const messagesView = this.registerDisposer(new MessagesView(this.loadedSubsource.messages));
    element.appendChild(sourceInfoLine);
    sourceInfoLine.appendChild(sourceType);
    element.appendChild(messagesView.element);
    let sourceTypeStr = '';
    const {subsource} = loadedSubsource.subsourceEntry;
    const {volume} = subsource;
    if (volume instanceof MultiscaleVolumeChunkSource) {
      sourceTypeStr = `${DataType[volume.dataType].toLowerCase()} volume`;
    } else if (subsource.mesh instanceof MeshSource) {
      sourceTypeStr = 'meshes (single-res.)';
    } else if (subsource.mesh instanceof MultiscaleMeshSource) {
      sourceTypeStr = 'meshes (multi-res.)';
    } else if (subsource.mesh instanceof SkeletonSource) {
      sourceTypeStr = 'skeletons';
    } else if (subsource.segmentPropertyMap !== undefined) {
      sourceTypeStr = 'segment property map';
    } else if (subsource.local !== undefined) {
      switch (subsource.local) {
        case LocalDataSource.annotations:
          sourceTypeStr = 'Local annotations';
          break;
        case LocalDataSource.equivalences:
          sourceTypeStr = 'local segmentation graph';
          break;
      }
    } else if (subsource.staticAnnotations !== undefined) {
      sourceTypeStr = 'default annotations';
    } else if (subsource.annotation !== undefined) {
      sourceTypeStr = 'annotations';
    } else if (subsource.singleMesh !== undefined) {
      sourceTypeStr = 'single mesh';
    } else if (subsource.segmentationGraph !== undefined) {
      sourceTypeStr = 'segmentation graph';
    }
    sourceType.textContent = sourceTypeStr;
  }
}

export class LoadedDataSourceView extends RefCounted {
  element = document.createElement('div');

  constructor(public source: Borrowed<LoadedLayerDataSource>) {
    super();
    const {element} = this;
    const enableDefaultSubsourcesLabel = document.createElement('label');
    enableDefaultSubsourcesLabel.classList.add('neuroglancer-layer-data-sources-source-default');
    enableDefaultSubsourcesLabel.appendChild(this.registerDisposer(new TrackableBooleanCheckbox({
                                                   changed: source.enabledSubsourcesChanged,
                                                   get value() {
                                                     return source.enableDefaultSubsources;
                                                   },
                                                   set value(value: boolean) {
                                                     if (source.enableDefaultSubsources === value)
                                                       return;
                                                     source.enableDefaultSubsources = value;
                                                     if (value) {
                                                       for (const subsource of source.subsources) {
                                                         subsource.enabled =
                                                             subsource.subsourceEntry.default;
                                                       }
                                                     }
                                                     source.enabledSubsourcesChanged.dispatch();
                                                   },
                                                 }))
                                                 .element);
    enableDefaultSubsourcesLabel.appendChild(
        document.createTextNode('Enable default subsource set'));
    enableDefaultSubsourcesLabel.title =
        'Enable the default set of subsources for this data source.';
    element.appendChild(enableDefaultSubsourcesLabel);
    for (const subsource of source.subsources) {
      element.appendChild(
          this.registerDisposer(new DataSourceSubsourceView(source, subsource)).element);
    }
    const {transform} = source;
    if (transform.mutableSourceRank || transform.value.sourceRank !== 0) {
      const transformWidget = this.registerDisposer(new CoordinateSpaceTransformWidget(
          source.transform, source.layer.localCoordinateSpaceCombiner,
          source.layer.manager.root.coordinateSpaceCombiner));
      this.element.appendChild(transformWidget.element);
    }
    this.registerDisposer(() => removeFromParent(this.element));
  }
}

function colorBarScale(value: string){
  // 处理平均每个格子单位量
  let unit = Math.floor(Number(value)/4);
  unit = getNearCale(Number(unit));
  //  获取单个格子像素
  let unitCalePX = Math.floor(Number( unit ) * 100 / Number(value));
  let len = Math.ceil(Number(value) / unit);
  const ul = document.createElement('ul');
  ul.classList.add('colorBarScale');
  for(let i = len; i >0; i--){
    const li = makeElement('li', ['colorBarScaleli'], {});
    li.style.height = i === len ? (100 - (len - 1) * unitCalePX) + 'px': unitCalePX + 'px';
    let text = i === len ? '' : formatterUnit( i * Number(unit), Number(unit) );
    const a = makeElement('a',[],{'href': 'javascript:void()'}, ( text.toString() ));
    li.appendChild(a);
    ul.appendChild(li);
  }  
  ul.appendChild(makeElement('a',[],{'href': 'javascript:void()'}, '0'));
  if(document.getElementsByClassName('colorBarScale')[0]){ let dom = document.getElementsByClassName('colorBarScale')[0]; dom.remove()}
  document.body.appendChild(ul)
}

function formatterUnit(value:number, unitValue: number){
  let unitArr = ['', 'k', 'M', 'G', 'T'];
  let unit = Math.floor( (value.toString().length - 1) / 3);   // 获取单位进制
  let isFormatterValue = Math.floor( (unitValue.toString().length - 1) / 3);   // 用于判断是否格式化
  let formatterValue = isFormatterValue > 0 ? unit > 0 ? ( (value / Math.pow(1000,unit)) + unitArr[unit] ) : (value + ''):(value + '');
  return formatterValue;
}

function getNearCale(value: number){
  const scalArr = [5, 10, 15, 20, 30, 50, 100, 200, 300, 500, 1000, 1500, 2000, 5000, 10000, 15000, 18000, 20000, 22000, 25000, 28000, 30000, 35000, 40000, 50000, 100000, 200000, 500000, 1000000, 2000000, 5000000, 10000000];
  let nearCale: number[] = [];
  scalArr.forEach((item)=>{ 
    if( (value / item) < 1 && nearCale.length < 1){
      nearCale.push( value);
    return;
    }else if(Math.floor(value / item) === 1){
      nearCale.push(item)
    } });
  let len = nearCale.length
  return nearCale[len - 1]
}

export class SelectBinView extends RefCounted{
  selectElement = document.createElement('select');
  // urlJson = JSON.parse( window.decodeURIComponent(window.location.href.split('!')[1]) );
  url = viewer.state.toJSON().layers[0].source;
  inputValue = this.url.split('/');
  lastParam:any = this.inputValue.splice(this.inputValue.length - 1, 1)
  constructor(public source: Borrowed<LoadedLayerDataSource>){
    super();
    // console.log(this.url, this.urlJson)
    this.selectElement.classList.add('neuroglancer-layer-side-panel-type-hq');
    this.selectElement.id = 'hqDefineSelect';
    this.selectElement.style.width = '100%';
    let binList = source.dataSource.subsources[0].subsource.annotation?.metadata?.binlist;
    viewer.dataSource = source.dataSource
    console.log(viewer.state.toJSON(), viewer)
    this.selectElement.style.display = binList?'block':'none';
    this.registerDisposer(() => removeFromParent(this.selectElement));
    if(binList?.length>0 && binList.includes(this.lastParam[0])){
      for(let i = 0; i < binList.length; i++){
        this.selectElement.options.add(new Option(binList[i], binList[i],false, binList[i] === this.lastParam[0]?true:false) );
      }
    }
    colorBarScale(source.dataSource.subsources[0].subsource.annotation?.metadata?.maxValue);
    (document.getElementsByClassName('colorBarScale')[0] as HTMLElement).style.display = 'block';
  }

  onchange = (urlInput: SourceUrlAutocomplete, flag: Boolean = true) => {
    let objS = (document.getElementsByClassName("neuroglancer-layer-side-panel-type-hq")[0] as HTMLInputElement).value;
    this.lastParam = this.inputValue.join('/')+'/'+objS;
    if(flag){
      urlInput.setValueAndSelection(this.lastParam);
      let explicit = true;
      urlInput.disableCompletion();
      urlInput.hideCompletions();
      urlInput.onCommit.dispatch(this.lastParam, explicit);
    }
  }
  
}

export class DataSourceView extends RefCounted {
  element = document.createElement('div');
  urlInput: SourceUrlAutocomplete;

  seenGeneration = 0;
  generation = -1;
  private loadedView: LoadedDataSourceView|undefined;
  private selectBinView: SelectBinView|undefined;
  constructor(public tab: Borrowed<LayerDataSourcesTab>, public source: Borrowed<LayerDataSource>) {
    super();
    const urlInput = this.urlInput = this.registerDisposer(new SourceUrlAutocomplete(this));
    const updateUrlFromView = (url: string, explicit: boolean) => {
      const {source} = this;
      const existingSpec = source.spec;
      const userLayer = this.source.layer;
      url = userLayer.manager.dataSourceProviderRegistry.normalizeUrl({url});
      if (url !== urlInput.value) {
        urlInput.disableCompletion();
        urlInput.setValueAndSelection(url, {begin: url.length, end: url.length});
      }
      urlInput.dirty.value = false;
      // If url is non-empty and unchanged, don't set spec, as that would trigger a reload of the
      // data source.  If the url is empty, always set spec in order to possible remove the empty
      // data source.
      if (url && url === existingSpec.url) {
        if (explicit) {
          if (tab.detectedLayerConstructor !== undefined) {
            changeLayerTypeToDetected(source.layer);
          }
        }
        return;
      }
      if (userLayer instanceof NewUserLayer) {
        try {
          const newName = userLayer.manager.dataSourceProviderRegistry.suggestLayerName(url);
          changeLayerName(userLayer.managedLayer, newName);
        } catch {
        }
      }
      source.spec = {...existingSpec, url};
    };
    urlInput.onCommit.add(updateUrlFromView);

    const {element} = this;
    element.classList.add('neuroglancer-layer-data-source');
    element.appendChild(urlInput.element);
    element.appendChild(this.registerDisposer(new MessagesView(source.messages)).element);
    this.updateView();
  }

  updateView() {
    const generation = this.source.changed.count;
    if (generation === this.generation) return;
    this.generation = generation;
    this.urlInput.value = this.source.spec.url;
    this.urlInput.dirty.value = false;
    const {loadState} = this.source;
    let {loadedView, selectBinView} = this;
    if (loadedView !== undefined) {
      if (loadedView.source === loadState) {
        return;
      }
      loadedView.dispose();
      loadedView = this.loadedView = undefined;
    }
    if (selectBinView !== undefined) {
      selectBinView.dispose();
      selectBinView = this.selectBinView = undefined;
    }
    if (loadState instanceof LoadedLayerDataSource) {
      loadedView = this.loadedView = new LoadedDataSourceView(loadState);
      selectBinView = this.selectBinView = new SelectBinView(loadState);
      this.element.appendChild(selectBinView.selectElement)
      this.element.appendChild(loadedView.element);
      selectBinView.selectElement.onchange =() =>{
        selectBinView?.onchange(this.urlInput);
      }
    }
  }

  disposed() {
    const {loadedView} = this;
    if (loadedView !== undefined) {
      loadedView.dispose();
    }
    removeFromParent(this.element);
    super.disposed();
  }
}

function changeLayerTypeToDetected(userLayer: UserLayer) {
  if (userLayer instanceof NewUserLayer) {
    const layerConstructor = userLayer.detectedLayerConstructor;
    if (layerConstructor !== undefined) {
      changeLayerType(userLayer.managedLayer, layerConstructor);
      return true;
    }
  }
  return false;
}

export class LayerDataSourcesTab extends Tab {
  generation = -1;
  sourceViews = new Map<LayerDataSource, DataSourceView>();
  private addDataSourceIcon = makeAddButton({title: 'Add additional data source'});
  private layerTypeDetection = document.createElement('div');
  private layerTypeElement = document.createElement('span');
  private dataSourcesContainer = document.createElement('div');
  private reRender: DebouncedFunction;
  
  constructor(public layer: Borrowed<UserLayer>) {
    super();
    const {element, dataSourcesContainer} = this;
    element.classList.add('neuroglancer-layer-data-sources-tab');
    dataSourcesContainer.classList.add('neuroglancer-layer-data-sources-container');
    const {addDataSourceIcon} = this;
    addDataSourceIcon.style.alignSelf = 'start';
    addDataSourceIcon.addEventListener('click', () => {
      const layerDataSource = this.layer.addDataSource(undefined);
      this.updateView();
      const view = this.sourceViews.get(layerDataSource);
      if (view === undefined) return;
      view.urlInput.inputElement.focus();
    });
    element.appendChild(this.dataSourcesContainer);
    if (layer instanceof NewUserLayer) {
      const {layerTypeDetection, layerTypeElement} = this;
      layerTypeDetection.style.display = 'none';
      layerTypeElement.classList.add('neuroglancer-layer-data-sources-tab-type-detection-type');
      layerTypeDetection.appendChild(document.createTextNode(`Create as `));
      layerTypeDetection.appendChild(layerTypeElement);
      layerTypeDetection.appendChild(document.createTextNode(` layer`));
      element.appendChild(layerTypeDetection);
      layerTypeDetection.classList.add('neuroglancer-layer-data-sources-tab-type-detection');
      layerTypeDetection.addEventListener('click', () => {
        changeLayerTypeToDetected(layer);
      });
    }
    const reRender = this.reRender = animationFrameDebounce(() => this.updateView());
    this.registerDisposer(layer.dataSourcesChanged.add(reRender));
    this.registerDisposer(this.visibility.changed.add(reRender));
    this.updateView();
  }

  detectedLayerConstructor: UserLayerConstructor|undefined = undefined;

  updateLayerTypeDetection() {
    const layerConstructor = (() => {
      const userLayer = this.layer;
      if (!(userLayer instanceof NewUserLayer)) return undefined;
      const layerConstructor = userLayer.detectedLayerConstructor;
      if (layerConstructor === undefined) return undefined;
      for (const view of this.sourceViews.values()) {
        if (view.urlInput.dirty.value) return undefined;
      }
      return layerConstructor;
    })();
    if (layerConstructor === this.detectedLayerConstructor) return;
    const {layerTypeDetection} = this;
    this.detectedLayerConstructor = layerConstructor;
    if (layerConstructor !== undefined) {
      const {layerTypeElement} = this;
      layerTypeElement.textContent = layerConstructor.type;
      layerTypeDetection.title =
          `Click here or press enter in the data source URL input box to create as ` +
          `${layerConstructor.type} layer`;
      layerTypeDetection.style.display = '';
    } else {
      layerTypeDetection.style.display = 'none';
    }
  }

  disposed() {
    const {sourceViews} = this;
    for (const dataSource of sourceViews.values()) {
      dataSource.dispose();
    }
    sourceViews.clear();
    super.disposed();
  }

  private updateView() {
    if (!this.visible) return;
    const generation = this.layer.dataSourcesChanged.count;
    if (generation !== this.generation) {
      this.generation = generation;
      const curSeenGeneration = Date.now();
      const {sourceViews} = this;
      const {layer} = this;
      function* getChildNodes(this: LayerDataSourcesTab) {
        let lastSourceUrlEmpty = true;
        const {dataSources} = layer;
        for (const source of dataSources) {
          let view = sourceViews.get(source);
          if (view === undefined) {
            view = new DataSourceView(this, source); // urlInput
            view.registerDisposer(view.urlInput.dirty.changed.add(this.reRender));
            sourceViews.set(source, view);
          }
          view.seenGeneration = curSeenGeneration;
          view.updateView();
          const url = source.spec.url;
          if (dataSources.length === 1 && url === '') {
            setTimeout(() => {
              view!.urlInput.inputElement.focus();
            }, 0);
          }
          lastSourceUrlEmpty = source.spec.url.length === 0;
          yield view.element;
        }
        if (!lastSourceUrlEmpty) {
          yield this.addDataSourceIcon;
        }
      }
      updateChildren(this.dataSourcesContainer, getChildNodes.call(this));
      for (const [source, view] of sourceViews) {
        if (view.seenGeneration !== curSeenGeneration) {
          view.dispose();
          sourceViews.delete(source);
        }
      }
    }
    this.updateLayerTypeDetection();
  }
}
