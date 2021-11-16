import './layer_gene_table.css'

import {Tab} from 'neuroglancer/widget/tab_view';
import {ManagedUserLayer, UserLayer} from 'neuroglancer/layer';
import { Borrowed } from '../util/disposable';
import { UserLayerWithAnnotationsMixin } from './annotations';
import { WatchableValue } from '../trackable_value';
import { AnnotationPropertySpec } from '../annotation';

const Base = UserLayerWithAnnotationsMixin(UserLayer);
export class AnnotationGeneLayer extends Base {
    annotationProperties = new WatchableValue<AnnotationPropertySpec[]|undefined>(undefined);
    constructor(managedLayer: Borrowed<ManagedUserLayer>) {
        super(managedLayer);
        this.tabs.add(
            'geneTable',
            {label: 'Gene Table', order: 20, getter: () => new GeneOptionsTab(this)});
        console.log('this.tabs',this.tabs)
    }
}

class GeneOptionsTab extends Tab{
    constructor(public layer: AnnotationGeneLayer) {
        super();
        const {element} = this;
        element.classList.add('neuroglancer-annotation-geneTable-tab');
        const TableHead = document.createElement('div')
        const geneSort = document.createElement('div')
        const countSort = document.createElement('div')
        const geneSpan = document.createElement('span')
        const countSpan = document.createElement('span')
        const geneSortASC = document.createElement('i')
        const geneSortDESC = document.createElement('i')
        const countSortASC = document.createElement('i')
        const countSortDESC = document.createElement('i')
        geneSpan.classList.add('.caret-wrapper')
        countSortASC.classList.add('sort-caret', 'ascending')
        countSortASC.classList.add('sort-caret', 'descending')
        geneSortASC.classList.add('sort-caret', 'ascending')
        geneSortASC.classList.add('sort-caret', 'descending')
        geneSort.appendChild(geneSpan);
        geneSort.innerText = 'Gene'
        geneSpan.appendChild(geneSortASC)
        geneSpan.appendChild(geneSortDESC)
        countSort.appendChild(countSpan);
        countSort.innerText = 'MIDCounts'
        countSpan.appendChild(countSortASC)
        countSpan.appendChild(countSortDESC)
        element.appendChild(TableHead)
        TableHead.appendChild(geneSort)
    }
}

// registerLayerType(GeneOptionsTab);
