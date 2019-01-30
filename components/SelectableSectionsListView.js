'use strict';
/* jshint esnext: true */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactNative, {
  // ListView,  // this
  StyleSheet,
  View,
  NativeModules,
  Animated, // this
} from 'react-native';
import merge from 'merge';
import { RecyclerListView, DataProvider } from 'recyclerlistview' // this

import SectionHeader from './SectionHeader';
import SectionList from './SectionList';
import CellWrapper from './CellWrapper';

const { UIManager } = NativeModules;

const AnimatedRecyclerListView = Animated.createAnimatedComponent(RecyclerListView) // this

export default class SelectableSectionsListView extends Component {

  constructor(props, context) {
    super(props, context);

    this.state = {
      // dataSource: new ListView.DataSource({
      //   rowHasChanged: (row1, row2) => row1 !== row2,
      //   sectionHeaderHasChanged: (prev, next) => prev !== next
      // }),
      dataProvider: new DataProvider((r1, r2) => r1 !== r2),  // this
      offsetY: 0
    };

    this.renderFooter = this.renderFooter.bind(this);
    this.renderHeader = this.renderHeader.bind(this);
    this.renderRow = this.renderRow.bind(this);
    this.renderSectionHeader = this.renderSectionHeader.bind(this);

    this.onScroll = this.onScroll.bind(this);
    this.onScrollAnimationEnd = this.onScrollAnimationEnd.bind(this);
    this.scrollToSection = this.scrollToSection.bind(this);

    // used for dynamic scrolling
    // always the first cell of a section keyed by section id
    this.cellTagMap = {};
    this.sectionTagMap = {};
    this.updateTagInCellMap = this.updateTagInCellMap.bind(this);
    this.updateTagInSectionMap = this.updateTagInSectionMap.bind(this);
  }

  componentWillMount() {
    this.calculateTotalHeight();
  }

  componentDidMount() {
    // push measuring into the next tick
    setTimeout(() => {
      UIManager.measure(ReactNative.findNodeHandle(this.refs.view), (x,y,w,h) => {
        this.containerHeight = h;
        if (this.props.contentInset && this.props.data && this.props.data.length > 0) {
          this.scrollToSection(Object.keys(this.props.data)[0]);
        }
      });
    }, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.data && nextProps.data !== this.props.data) {
      this.calculateTotalHeight(nextProps.data);
    }
  }

  calculateTotalHeight(data) {
    data = data || this.props.data;

    if (Array.isArray(data)) {
      return;
    }

    this.sectionItemCount = {};
    this.totalHeight = Object.keys(data)
      .reduce((carry, key) => {
        var itemCount = data[key].length;
        carry += itemCount * this.props.cellHeight;
        carry += this.props.sectionHeaderHeight || 0;

        this.sectionItemCount[key] = itemCount;

        return carry;
      }, 0);
  }

  updateTagInSectionMap(tag, section) {
    this.sectionTagMap[section] = tag;
  }

  updateTagInCellMap(tag, section) {
    this.cellTagMap[section] = tag;
  }

  getListView = () => {
    if (this.props.collapsible) {
      return this._recyclerListView.getNode(); 
    } else {
      return this._recyclerListView;
    }
  }

  scrollToSection(section) {
    let y = 0;
    let headerHeight = this.props.headerHeight || 0;
    y += headerHeight;
    
    if(this.props.contentInset) {
        y -= this.props.contentInset.top - headerHeight
    }

    if (!this.props.useDynamicHeights) {
      const cellHeight = this.props.cellHeight;
      let sectionHeaderHeight = this.props.sectionHeaderHeight || 0;
      let keys = Object.keys(this.props.data);
      if (typeof(this.props.compareFunction) === "function") {
        keys = keys.sort(this.props.compareFunction);
      }
      const index = keys.indexOf(section);

	  // this
      let numcells = 0;
	  if (index > 0) {		  
		  for (var i = 0; i <= index; i++) {
			numcells += this.props.data[keys[i]].length;	   
		  }
	  }															  
	   //end

      sectionHeaderHeight = index * sectionHeaderHeight;
      y += numcells * cellHeight + sectionHeaderHeight;
      const maxY = this.totalHeight - this.containerHeight + headerHeight;
      y = y > maxY ? maxY : y;

      this.getListView().scrollToOffset(0, y, true);   // this
    } else {
      UIManager.measureLayout(this.cellTagMap[section], ReactNative.findNodeHandle(this.getListView()), () => {}, (x, y, w, h) => { // this
        y = y - this.props.sectionHeaderHeight; // this
        this.getListView().scrollToOffset(0, y, true); 
      });
    }

    this.props.onScrollToSection && this.props.onScrollToSection(section);
  }

  renderSectionHeader(sectionData, sectionId) {
    const updateTag = this.props.useDynamicHeights ?
      this.updateTagInSectionMap :
      null;

    const title = this.props.getSectionTitle ?
      this.props.getSectionTitle(sectionId) :
      sectionId;

    return (
      <SectionHeader
        component={this.props.sectionHeader}
        title={title}
        sectionId={sectionId}
        sectionData={sectionData}
        updateTag={updateTag}
      />
    );
  }

  renderFooter() {
    const Footer = this.props.footer;
    return <Footer />;
  }

  renderHeader() {
    const Header = this.props.header;
    return <Header />;
  }

  renderRow(type, data) {  // this
    const CellComponent = this.props.cell;
    // index = parseInt(index, 10);

    // const isFirst = index === 0;
    // const isLast = this.sectionItemCount && this.sectionItemCount[sectionId]-1 === index;
    const lastItem = this.props.dataSource[this.props.dataSource.length - 1];   // this
    const isLast = lastItem !== null ? lastItem.data.id === data.data.id : false;

    const props = {
      // isFirst,
      isLast,
      enableCheckBox: this.props.enableCheckBox,  // this
      // sectionId,
      // index,
      item: data,  // this
      offsetY: this.state.offsetY,
      onSelect: this.props.onCellSelect
    };

    return (<CellComponent {...props} {...this.props.cellProps} />);  // this

    // return index === 0 && this.props.useDynamicHeights ?
    //   <CellWrapper
    //     updateTag={this.updateTagInCellMap}
    //     component={CellComponent} {...props} {...this.props.cellProps} /> :
    //   <CellComponent {...props} {...this.props.cellProps} />;
  }

  onScroll(e) {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (this.props.updateScrollState) {
      this.setState({
        offsetY
      });
    }

    this.props.onScroll && this.props.onScroll(e);
  }

  onScrollAnimationEnd(e) {
    if (this.props.updateScrollState) {
      this.setState({
        offsetY: e.nativeEvent.contentOffset.y
      });
    }
  }

  render() {
    const { data, layoutProvider} = this.props;   // this
    // const dataIsArray = Array.isArray(data);
    let sectionList;
    let renderSectionHeader;
    // let dataSource;  
    let sections = Object.keys(data);

    if (typeof(this.props.compareFunction) === "function") {
      sections = sections.sort(this.props.compareFunction);
    }

    // if (dataIsArray) {
    //   dataSource = this.state.dataSource.cloneWithRows(data);
    // } else {
      sectionList = !this.props.hideSectionList ?
        <SectionList
          style={this.props.sectionListStyle}
          onSectionSelect={this.scrollToSection}
          sections={sections}
          data={data}
          getSectionListTitle={this.props.getSectionListTitle}
          component={this.props.sectionListItem}
          fontStyle={this.props.sectionListFontStyle}
          headerNavHeight={this.props.headerNavHeight}  // this
        /> :
        null;

      renderSectionHeader = this.renderSectionHeader;
      // dataSource = this.state.dataSource.cloneWithRowsAndSections(data, sections); // this
    // }

    const renderFooter = this.props.footer ?
      this.renderFooter :
      this.props.renderFooter;

    const renderHeader = this.props.header ?
      this.renderHeader :
      this.props.renderHeader;

    // const props = merge({}, this.props, {
    //   onScroll: this.onScroll,
    //   onScrollAnimationEnd: this.onScrollAnimationEnd,
    //   dataSource,
    //   renderFooter,
    //   renderHeader,
    //   renderRow: this.renderRow,
    //   renderSectionHeader
    // });

    // props.style = void 0;

    // return (
    //   <View ref="view" style={[styles.container, this.props.style]}>
    //     <ListView
    //       ref="listview"
    //       {...props}
    //     />
    //     {sectionList}
    //   </View>
    // );
 
    // this
    if (this.props.collapsible) {     
      const { animatedY, onScroll, paddingHeight } = this.props.collapsible      
      return (  
        <View ref="view" style={[styles.container, this.props.style]}>        
          <AnimatedRecyclerListView
            ref={(ref) => { this._recyclerListView = ref }}
            style={styles.container} 
            // onEndReached={this.handleListEnd}
            dataProvider={this.state.dataProvider.cloneWithRows(this.props.dataSource)}
            layoutProvider={layoutProvider}
            rowRenderer={this.renderRow}
            // renderFooter={this.renderFooter} 
             // onLayout={this.props.onRenderFinish} 
            // contentContainerStyle={{paddingTop: paddingHeight}}
            // scrollIndicatorInsets={{top: paddingHeight}}
            onScroll={onScroll}       
            _mustAddThis={animatedY}                
            />
          {/* <View style={this.props.sectionListTempStyle}/> */}
          {sectionList}
        </View>
      );
    } 
 
    return (  
      <View ref="view" style={[styles.container, this.props.style]}>        
        <RecyclerListView
          ref={(ref) => { this._recyclerListView = ref }}
          style={styles.container} 
          // onEndReached={this.handleListEnd}
          dataProvider={this.state.dataProvider.cloneWithRows(this.props.dataSource)}
          layoutProvider={layoutProvider}
          rowRenderer={this.renderRow}
          // renderFooter={this.renderFooter}
          // onLayout={this.props.onRenderFinish} 
          onScroll={this.props.onScroll}             
          />
        {/* <View style={this.props.sectionListTempStyle}/> */}
        {sectionList}
      </View>
    );     
    // end
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

const stylesheetProp = PropTypes.oneOfType([
  PropTypes.number,
  PropTypes.object,
  PropTypes.array,    // this
]);

SelectableSectionsListView.propTypes = {
  // this
  dataSource: PropTypes.array.isRequired,
  enableCheckBox: PropTypes.bool,
  layoutProvider: PropTypes.object,
  collapsible: PropTypes.object,
  headerNavHeight: PropTypes.number,
  // onRenderFinish: PropTypes.func, 
  // end

  /**
   * The data to render in the listview
   */
  data: PropTypes.oneOfType([
    PropTypes.array,
    PropTypes.object,
  ]).isRequired,

  /**
   * Whether to show the section listing or not
   */
  hideSectionList: PropTypes.bool,

  /**
   * Functions to provide a title for the section header and the section list
   * items. If not provided, the section ids will be used (the keys from the data object)
   */
  getSectionTitle: PropTypes.func,
  getSectionListTitle: PropTypes.func,

  /**
   * Function to sort sections. If not provided, the sections order will match data source
   */
  compareFunction: PropTypes.func,

  /**
   * Callback which should be called when a cell has been selected
   */
  onCellSelect: PropTypes.func,

  /**
   * Callback which should be called when the user scrolls to a section
   */
  onScrollToSection: PropTypes.func,

  /**
   * The cell element to render for each row
   */
  cell: PropTypes.func.isRequired,

  /**
   * A custom element to render for each section list item
   */
  sectionListItem: PropTypes.func,

  /**
   * A custom element to render for each section header
   */
  sectionHeader: PropTypes.func,

  /**
   * A custom element to render as footer
   */
  footer: PropTypes.func,

  /**
   * A custom element to render as header
   */
  header: PropTypes.func,

  /**
   * The height of the header element to render. Is required if a
   * header element is used, so the positions can be calculated correctly
   */
  headerHeight: PropTypes.number,

  /**
   * A custom function to render as footer
   */
  renderHeader: PropTypes.func,

  /**
   * A custom function to render as header
   */
  renderFooter: PropTypes.func,

  /**
   * An object containing additional props, which will be passed
   * to each cell component
   */
  cellProps: PropTypes.object,

  /**
   * The height of the section header component
   */
  sectionHeaderHeight: PropTypes.number,

  /**
   * The height of the cell component
   */
  cellHeight: PropTypes.number.isRequired,

  /**
   * Whether to determine the y postion to scroll to by calculating header and
   * cell heights or by using the UIManager to measure the position of the
   * destination element. This is an exterimental feature
   */
  useDynamicHeights: PropTypes.bool,

  /**
   * Whether to set the current y offset as state and pass it to each
   * cell during re-rendering
   */
  updateScrollState: PropTypes.bool,

  /**
   * Styles to pass to the container
   */
  style: stylesheetProp,

  /**
   * Styles to pass to the section list container
   */
  sectionListStyle: stylesheetProp,

  /**
   * Selector styles
   */
  sectionListFontStyle: stylesheetProp,
};
