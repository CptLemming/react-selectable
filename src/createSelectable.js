import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const createSelectable = (WrappedComponent) => {
	class SelectableItem extends React.Component {

		componentDidMount () {
			// Cannot remove findDOMNode here:
			// There's no nice way to pass refs to function components
			this.context.selectable.register(this.props.selectableKey, ReactDOM.findDOMNode(this));
		}


		componentWillUnmount () {
			this.context.selectable.unregister(this.props.selectableKey);
		}


		render () {
			return React.createElement(
				WrappedComponent,
				this.props,
				this.props.children
			);
		}
	}

	SelectableItem.contextTypes = {
		selectable: PropTypes.object
	};

	SelectableItem.propTypes = {
		selectableKey: PropTypes.any.isRequired
	};

	return SelectableItem;
}


export default createSelectable;
