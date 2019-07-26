import React, { createRef } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import isNodeInRoot from './nodeInRoot';
import isNodeIn from './isNodeIn';
import getBoundsForNode from './getBoundsForNode';
import doObjectsCollide from './doObjectsCollide';
import throttle from 'lodash.throttle';

class SelectableGroup extends React.Component {
	constructor (props) {
		super(props);

		this.state = {
			isBoxSelecting: false,
			boxWidth: 0,
			boxHeight: 0,
			scrollLeftShift: 0,
			scrollTopShift: 0
		}

		this._mouseDownData = null;
		this._rect = null;
		this._registry = [];

		// Used to prevent actions from firing twice on devices that are both click and touch enabled
		this._mouseDownStarted = false;
		this._mouseMoveStarted = false;
		this._mouseUpStarted = false;

		this._openSelector = this._openSelector.bind(this);
		this._doScroll = this._doScroll.bind(this);
		this._mouseDown = this._mouseDown.bind(this);
		this._mouseUp = this._mouseUp.bind(this);
		this._selectElements = this._selectElements.bind(this);
		this._registerSelectable = this._registerSelectable.bind(this);
		this._unregisterSelectable = this._unregisterSelectable.bind(this);
		this._desktopEventCoords = this._desktopEventCoords.bind(this);

		this._throttledSelect = throttle(this._selectElements, 50);
	}

	selectableRef = createRef();

	getChildContext () {
		return {
			selectable: {
				register: this._registerSelectable,
				unregister: this._unregisterSelectable
			}
		};
	}

	componentDidMount () {
		this._applyMousedown(this.props.enabled);
		this._rect = this._getInitialCoordinates();
	}

	/**
	 * Remove global event listeners
	 */
	componentWillUnmount () {
		this._applyMousedown(false);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.enabled !== this.props.enabled) {
			this._applyMousedown(nextProps.enabled);
		}
	}

	_registerSelectable (key, domNode) {
		this._registry.push({key, domNode});
	}


	_unregisterSelectable (key) {
		this._registry = this._registry.filter(data => data.key !== key);
	}

	_applyMousedown(apply) {
		const funcName = apply ? 'addEventListener' : 'removeEventListener';
		if (this.selectableRef.current) {
			this.selectableRef.current[funcName]('mousedown', this._mouseDown);
			this.selectableRef.current[funcName]('touchstart', this._mouseDown);

			if (this.props.manageScroll) this.selectableRef.current.parentElement[funcName]('scroll', this._doScroll);
		}
	}

	changeScrollOffsets (scrollLeftShift = 0, scrollTopShift = 0) {
		this.setState({
			scrollLeftShift,
			scrollTopShift
		});

 		this._throttledSelect();
	}

	/**
	 * Called while moving the mouse with the button down. Changes the boundaries
	 * of the selection box
	 */
	_openSelector (event) {
		if (this._mouseMoveStarted) return;
		this._mouseMoveStarted = true;

 		const e = this._desktopEventCoords(event);

		const horizontalDirection = e.pageX - this._rect.x + this.state.scrollLeftShift < this._mouseDownData.initialW;
		const verticalDirection = e.pageY - this._rect.y + this.state.scrollTopShift < this._mouseDownData.initialH;

	    this.setState({
	    	isBoxSelecting: true,
	    	boxWidth: Math.abs(this._mouseDownData.initialW - e.pageX + this._rect.x - this.state.scrollLeftShift),
	    	boxHeight: Math.abs(this._mouseDownData.initialH - e.pageY + this._rect.y - this.state.scrollTopShift),
	    	boxLeft: horizontalDirection ? e.pageX - this._rect.x + this.state.scrollLeftShift : this._mouseDownData.initialW,
			boxTop: verticalDirection ? e.pageY - this._rect.y + this.state.scrollTopShift : this._mouseDownData.initialH,
			directionX: horizontalDirection ? 1 : -1,
			directionY: verticalDirection ? 1 : -1
	    }, () => {
			this._mouseMoveStarted = false;
		});

		if (this.props.selectOnMouseMove) this._throttledSelect(e);
	}

	_getInitialCoordinates() {
		if (this.props.fixedPosition) {
			return { x: 0, y: 0 }
		}

		const style = window.getComputedStyle(document.body);
		const t = style.getPropertyValue('margin-top');
		const l = style.getPropertyValue('margin-left');
		const mLeft = parseInt(l.slice(0, l.length - 2), 10);
		const mTop = parseInt(t.slice(0, t.length - 2), 10);

		const bodyRect = document.body.getBoundingClientRect();
		const elemRect = this.selectableRef.current.getBoundingClientRect();
		return { 
			x: Math.round(elemRect.left - bodyRect.left + mLeft),
			y: Math.round(elemRect.top - bodyRect.top + mTop)
		};
	}

	_doScroll () {
		if (!this._mouseDownData) return;

		this.changeScrollOffsets(
			this.selectableRef.current.parentElement.scrollLeft - this._mouseDownData.initialScrollLeft,
			this.selectableRef.current.parentElement.scrollTop - this._mouseDownData.initialScrollTop
		);
	}

	/**
	 * Called when a user presses the mouse button. Determines if a select box should
	 * be added, and if so, attach event listeners
	 */
	_mouseDown (event) {
		// Disable if target is control by react-dnd
		if (isNodeIn(event.target, node => !!node.draggable)) return;

		if (this._mouseDownStarted) return;
		this._mouseDownStarted = true; 
		this._mouseUpStarted = false;
 		const e = this._desktopEventCoords(event);

		const node = this.selectableRef.current;
		let collides, offsetData, distanceData;
		window.addEventListener('mouseup', this._mouseUp);
		window.addEventListener('touchend', this._mouseUp);

		// Right clicks
		if(e.which === 3 || e.button === 2) return;

		if(!isNodeInRoot(e.target, node)) {
			offsetData = getBoundsForNode(node);
			collides = doObjectsCollide(
				{
					top: offsetData.top,
					left: offsetData.left,
					bottom: offsetData.offsetHeight,
					right: offsetData.offsetWidth
				},
				{
					top: e.pageY - this._rect.y,
					left: e.pageX - this._rect.x,
					offsetWidth: 0,
					offsetHeight: 0
				}
			);
			if(!collides) return;
		}
		this._rect = this._getInitialCoordinates();

		const initialScrollLeft = this.selectableRef.current.parentElement.scrollLeft;
		const initialScrollTop = this.selectableRef.current.parentElement.scrollTop;

		const initialLeft = e.pageX - this._rect.x;
		const initialTop = e.pageY - this._rect.y;

		this._mouseDownData = {
			boxLeft: initialLeft,
			boxTop: initialTop,
	        initialW: initialLeft,
			initialH: initialTop,
			initialScrollLeft,
			initialScrollTop
		};

		if (this.props.preventDefault && e.cancelable) e.preventDefault();

		window.addEventListener('mousemove', this._openSelector);
		window.addEventListener('touchmove', this._openSelector);
	}

	/**
	 * Called when the user has completed selection
	 */
	_mouseUp (e) {
		if (this._mouseUpStarted) return;
		this._mouseUpStarted = true;
		this._mouseDownStarted = false;

		e.stopPropagation();
	    window.removeEventListener('mousemove', this._openSelector);
	    window.removeEventListener('mouseup', this._mouseUp);
	    window.removeEventListener('touchmove', this._openSelector);
	    window.removeEventListener('touchend', this._mouseUp);

	    if (!this._mouseDownData) return;

	    // Mouse up when not box selecting is a heuristic for a "click"
		if (this.props.onNonItemClick && !this.state.isBoxSelecting) {
			if (!this._registry.some(({ domNode }) => isNodeInRoot(e.target, domNode))) {
				this.props.onNonItemClick(e);
			}
		}

		this._selectElements(e);

		this._mouseDownData = null;
		this.setState({
			isBoxSelecting: false,
			boxWidth: 0,
			boxHeight: 0,
			scrollLeftShift: 0,
			scrollTopShift: 0
		});
	}

	/**
	 * Selects multiple children given x/y coords of the mouse
	 */
	_selectElements (event) {
		const { tolerance } = this.props;
	    const currentItems = [];
		const selectbox = this.selectbox;

		if (!selectbox) return;

		this._registry.forEach(itemData => {
			if (
				itemData.domNode
				&& doObjectsCollide(selectbox, itemData.domNode, tolerance)
				&& !currentItems.includes(itemData.key)
			) {
				currentItems.push(itemData.key);
			}
		});

		this.props.onSelection(currentItems, event);
	}

	/**
	 * Used to return event object with desktop (non-touch) format of event 
	 * coordinates, regardless of whether the action is from mobile or desktop.
	 */
	_desktopEventCoords (e){
		if (e.pageX == undefined || e.pageY == undefined){ // Touch-device
			e.pageX = e.targetTouches[0].pageX;
			e.pageY = e.targetTouches[0].pageY;
		}
		return e;
	}

	/**
	 * Renders the component
	 * @return {ReactComponent}
	 */
	render () {
		const { children, enabled, className, selectingClassName } = this.props;
		const Component = this.props.component;
		const {
			isBoxSelecting,
			boxLeft,
			boxTop,
			boxWidth,
			boxHeight
		} = this.state;

		if (!enabled) {
			return (
				<Component className={className}>
					{children}
				</Component>
			);
		}

		const boxStyle = {
			left: boxLeft,
			top: boxTop,
			width: boxWidth,
			height: boxHeight,
			zIndex: 9000,
			position: 'absolute',
			cursor: 'default'
		};

		const spanStyle = {
			backgroundColor: 'transparent',
			border: '1px dashed #999',
			width: '100%',
			height: '100%',
			float: 'left'
		};

		const wrapperStyle = {
			position: 'relative',
			overflow: 'visible'
		};

		return (
			<Component ref={this.selectableRef} className={classnames(className)} style={wrapperStyle}>
				{isBoxSelecting && <div className={selectingClassName} style={boxStyle} ref={node => this.selectbox = node}>
					<span style={spanStyle} />
				</div>}
				{children}
			</Component>
		);
	}
}

SelectableGroup.propTypes = {
	/**
	 * Event that will fire when items are selected. Passes an array of keys
	 */
	onSelection: PropTypes.func,

	/**
	 * The component that will represent the Selectable DOM node
	 */
	component: PropTypes.node,

	/**
	 * Amount of forgiveness an item will offer to the selectbox before registering
	 * a selection, i.e. if only 1px of the item is in the selection, it shouldn't be
	 * included.
	 */
	tolerance: PropTypes.number,

	/**
	 * Enable to fire the onSelection callback while the mouse is moving. Throttled to 50ms
	 * for performance in IE/Edge
	 * @type boolean
	 */
	selectOnMouseMove: PropTypes.bool,

    /**
	 * Allows to enable/disable preventing the default action of the onmousedown event (with e.preventDefault).
     * True by default. Disable if your app needs to capture this event for other functionalities.
	 * @type boolean
	 */
    preventDefault: PropTypes.bool,

    /**
     * Triggered when the user clicks in the component, but not on an item, e.g. whitespace
     *
     * @type {Function}
     */
    onNonItemClick: PropTypes.func,

    /**
     * If false, all of the selectble features are turned off.
     * @type boolean
     */
	enabled: PropTypes.bool,

	/**
     * If true, will check parent element for scroll position.
     * @type boolean
     */
    manageScroll: PropTypes.bool,

    /**
     * A CSS class to add to the containing element
     * @type {string}
     */
    className: PropTypes.string,
};

SelectableGroup.defaultProps = {
	onSelection: () => {},
	component: 'div',
	tolerance: 0,
	selectOnMouseMove: false,
    preventDefault: true,
	enabled: true,
	manageScroll: true,
};

SelectableGroup.childContextTypes = {
	selectable: PropTypes.object
};

export default SelectableGroup;
