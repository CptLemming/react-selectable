import React, { Component, createRef } from 'react';
import PropTypes from 'prop-types';

const createSelectable = (WrappedComponent) => {
	class SelectableItem extends Component {
		itemRef = createRef();

		componentDidMount () {
			this.context.selectable.register(this.props.selectableKey, this.itemRef.current);
		}

		componentWillUnmount () {
			this.context.selectable.unregister(this.props.selectableKey);
		}

		render () {
          return <div className={this.props.selectableClassName} ref={this.itemRef} id={"selectableItem-"+this.props.selectableKey}>
            <WrappedComponent {...this.props}>
              {this.props.children}
            </WrappedComponent>
          </div>
		}
	}

	SelectableItem.contextTypes = {
		selectable: PropTypes.object
	};

	SelectableItem.propTypes = {
		selectableClassName: PropTypes.string,
		selectableKey: PropTypes.any.isRequired
	};

	return SelectableItem;
}


export default createSelectable;
