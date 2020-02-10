import React from 'react';
import clone from "clone";
import PropTypes from "prop-types";
import './App.css';

class App extends React.Component {
  render() {
    return (
      <div className="game">
        <div className="game-board">
          <Board
          />
        </div>
        <div className="game-controls">
        </div>
      </div>
    );
  }
}

function Square(props) {
  return (
    <input className="square">
    </input>
  );
}

class TableDragSelect extends React.Component {
  static propTypes = {
    data: props => {
      const error = new Error(
        "Invalid prop `data` supplied to `TableDragSelect`. Validation failed."
      );
      if (!Array.isArray(props.data)) {
        return error;
      }
      if (props.data.length === 0) {
        return;
      }
      const columnCount = props.data[0].length;
      for (const row of props.data) {
        if (!Array.isArray(row) || row.length !== columnCount) {
          return error;
        }
        for (const cell of row) {
          if (typeof cell.selected !== "boolean") {
            return error;
          }
        }
      }
    },
    maxRows: PropTypes.number,
    maxColumns: PropTypes.number,
    onSelectionStart: PropTypes.func,
    onInput: PropTypes.func,
    onChange: PropTypes.func,
    children: props => {
      if (TableDragSelect.propTypes.data(props)) {
        return; // Let error be handled elsewhere
      }
      const error = new Error(
        "Invalid prop `children` supplied to `TableDragSelect`. Validation failed."
      );
      const trs = React.Children.toArray(props.children);
      const rowCount = props.data.length;
      const columnCount = props.data.length === 0 ? 0 : props.data[0].length;
      if (trs.length !== rowCount) {
        return error;
      }
      for (const tr of trs) {
        const tds = React.Children.toArray(tr.props.children);
        if (tr.type !== "tr" || tds.length !== columnCount) {
          return error;
        }
        for (const td of tds) {
          if (td.type !== "td") {
            return error;
          }
        }
      }
    }
  };

  static defaultProps = {
    data: {},
    maxRows: Infinity,
    maxColumns: Infinity,
    onSelectionStart: () => {},
    onInput: () => {},
    onChange: () => {}
  };

  state = {
    selectionStarted: false,
    shouldAppend: false,
    selection: []
  };

  componentDidMount = () => {
    window.addEventListener("mouseup", this.handleTouchEndWindow);
    window.addEventListener("touchend", this.handleTouchEndWindow);
    window.addEventListener("keydown", this.handleKeyPressWindow);
  };

  componentWillUnmount = () => {
    window.removeEventListener("mouseup", this.handleTouchEndWindow);
    window.removeEventListener("touchend", this.handleTouchEndWindow);
    window.removeEventListener("keydown", this.handleKeyPressWindow);
  };

  render = () => {
    return (
      <table className="table-drag-select">
        <tbody>{this.renderRows()}</tbody>
      </table>
    );
  };

  renderRows = () =>
    React.Children.map(this.props.children, (tr, i) => {
      return (
        <tr key={i} {...tr.props}>
          {React.Children.map(tr.props.children, (cell, j) => (
            <Cell
              key={j}
              onTouchStart={this.handleTouchStartCell}
              onTouchMove={this.handleTouchMoveCell}
              fixedValue={cell.props.children}
              value={this.props.data[i][j].value}
              centerNote={this.props.data[i][j].centerNote}
              cornerNote={this.props.data[i][j].cornerNote}
              selected={this.props.data[i][j].selected}
              beingSelected={this.isCellBeingSelected(i, j)}
              {...cell.props}
            >
              {cell.props.children}
            </Cell>
          ))}
        </tr>
      );
    });

  resetSelection() {
    const data = clone(this.props.data);
    for(let i = 0; i < data.length; i++)
    {
      for(let j = 0; j < data[i].length; j++)
      {
        data[i][j].selected = false;
      }
    }
    this.setState({ selection: null, selectionStarted: false });
    this.props.onChange(data); 
  }

  handleTouchStartCell = e => {
    const isLeftClick = e.button === 0;
    const isTouch = e.type !== "mousedown";
    if (!this.state.selectionStarted && (isLeftClick || isTouch)) {
      this.resetSelection();
      e.preventDefault();
      const { row, column } = eventToCellLocation(e);
      this.props.onSelectionStart({ row, column });
      this.setState(prevState => ({
        selectionStarted: true,
        selection: [{ row, column }]
      }));
    }
  };

  handleTouchMoveCell = e => {
    if (this.state.selectionStarted) {
      e.preventDefault();
      const { row, column } = eventToCellLocation(e);
      // Do nothing if we already added that cell to the selection
      if(this.state.selection.some(e => e.row === row && e.column === column)) return;

      this.setState(prevState => ({
        selection: [...prevState.selection, { row, column }]
      }));
    }
  };

  handleTouchEndWindow = e => {
    const isLeftClick = e.button === 0;
    const isTouch = e.type !== "mousedown";
    if (this.state.selectionStarted && (isLeftClick || isTouch)) {
      const data = clone(this.props.data);
      this.state.selection.forEach(element => {
        data[element.row][element.column].selected = true;
      });
      this.setState({ selectionStarted: false });
      this.props.onChange(data);
    }
    else{
      this.resetSelection();
    }
  };

  handleKeyPressWindow = e => {
    e.preventDefault();
    if (this.state.selection === null) return;
    const data = clone(this.props.data);
    console.log(e);

    let shouldDelete = e.keyCode === 46 || e.keyCode === 8;
    let isNumpadNumber = e.code.indexOf("Numpad") !== -1
    let isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || isNumpadNumber;
    let valueToInsert = shouldDelete ? null : isNumpadNumber ? e.code.substring(6) : String.fromCharCode(e.keyCode);

    let shouldUpdateData = false;
    // Delete
    if(shouldDelete)
    {
      this.state.selection.forEach(element => {
        shouldUpdateData = true;
        data[element.row][element.column].cornerNote = valueToInsert
        data[element.row][element.column].centerNote = valueToInsert
        data[element.row][element.column].value = valueToInsert
      });
    }
    // Shift + Number
    else if (e.shiftKey && isNumber) {
      shouldUpdateData = true;
      this.state.selection.forEach(element => {
        data[element.row][element.column].cornerNote = valueToInsert
      });
    }
     // Control + Number
    else if (e.ctrlKey && isNumber) {
      shouldUpdateData = true;
      this.state.selection.forEach(element => {
        data[element.row][element.column].centerNote = valueToInsert
      });
    }
    // Number
    else if (isNumber) {
      shouldUpdateData = true;
      this.state.selection.forEach(element => {
        data[element.row][element.column].value = valueToInsert
      });
    }
    
    if(shouldUpdateData){
      this.props.onChange(data);
    }
  };

  isCellBeingSelected = (row, column) => {
    return this.state.selectionStarted && this.state.selection.some(e => e.row === row && e.column === column);
  };
}

class Cell extends React.Component {
  // This optimization gave a 10% performance boost while drag-selecting cells
  shouldComponentUpdate = nextProps =>
    this.props.beingSelected !== nextProps.beingSelected ||
    this.props.selected !== nextProps.selected ||
    this.props.value !== nextProps.value ||
    this.props.centerNote !== nextProps.centerNote ||
    this.props.cornerNote !== nextProps.cornerNote;

  componentDidMount = () => {
    // We need to call addEventListener ourselves so that we can pass
    // {passive: false}
    this.td.addEventListener("touchstart", this.handleTouchStart, {
      passive: false
    });
    this.td.addEventListener("touchmove", this.handleTouchMove, {
      passive: false
    });
  };

  componentWillUnmount = () => {
    this.td.removeEventListener("touchstart", this.handleTouchStart);
    this.td.removeEventListener("touchmove", this.handleTouchMove);
  };

  render = () => {
    let {
      className = "",
      disabled,
      beingSelected,
      selected,
      onTouchStart,
      onTouchMove,
      value,
      cornerNote,
      centerNote,
      fixedValue,
      ...props
    } = this.props;
    if (disabled) {
      className += " cell-disabled";
    } else {
      className += " cell-enabled";
      if (selected) {
        className += " cell-selected";
      }
      if (beingSelected) {
        className += " cell-being-selected";
      }
    }

    let cellValue;
    if(fixedValue && fixedValue.trim())
    {
      cellValue = fixedValue;
      className += " cell-fixed-value";
    }
    else
    {
      cellValue = value;
    }
    return (
      <td
        ref={td => (this.td = td)}
        className={className}
        onMouseDown={this.handleTouchStart}
        onMouseMove={this.handleTouchMove}
        {...props}
      >
        {cellValue}
      </td>
    );
  };

  handleTouchStart = e => {
    if (!this.props.disabled) {
      this.props.onTouchStart(e);
    }
  };

  handleTouchMove = e => {
    if (!this.props.disabled) {
      this.props.onTouchMove(e);
    }
  };
}

// Takes a mouse or touch event and returns the corresponding row and cell.
// Example:
// eventToCellLocation(event);
// returns {row: 2, column: 3}
const eventToCellLocation = e => {
  let target;
  // For touchmove and touchend events, e.target and e.touches[n].target are
  // wrong, so we have to rely on elementFromPoint(). For mouse clicks, we have
  // to use e.target.
  if (e.touches) {
    const touch = e.touches[0];
    target = document.elementFromPoint(touch.clientX, touch.clientY);
  } else {
    target = e.target;
    while (target.tagName !== "TD") {
      target = target.parentNode;
    }
  }
  return {
    row: target.parentNode.rowIndex,
    column: target.cellIndex
  };
};

class Board extends React.Component {
  constructor(props) {
    super(props);
    let gridSize = 11;
    let grid = new Array(gridSize).fill((null)).map(() => new Array(gridSize).fill(null).map(() => (
      {
        selected: false,
        value: null,
        cornerNote: null,
        centerNote: null,
        fixedValue: null
      })));

    this.state = {
      cells: grid
    };
  }

  renderSquare(i) {
    return (
      <Square/>
    );
  }

    render = () =>
      <TableDragSelect
        data={this.state.cells}
        onChange={cells => this.setState({ cells })}
      >
        <tr>
        <td> </td>
        <td> </td>
        <td> 3</td>
        <td> </td>
        <td>4 </td>
        <td>1 </td>
        <td>7 </td>
        <td> </td>
        <td>1 </td>
        <td> </td>
        <td> </td>
        </tr>
        <tr>
        <td> </td>
        <td> 3</td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> 1</td>
        <td> </td>
        </tr>
        <tr>
        <td>2 </td>
        <td> </td>
        <td>3 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> 1</td>
        <td> </td>
        <td> 3</td>
        </tr>
        <tr>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> 9</td>
        <td> </td>
        <td> 9</td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        </tr>
        <tr>
        <td>3 </td>
        <td> </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td> </td>
        <td>3 </td>
        </tr>
        <tr>
        <td>1 </td>
        <td> </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td> </td>
        <td>6 </td>
        </tr>
        <tr>
        <td>3 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td>9 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td>2 </td>
        </tr>
        <tr>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> 9 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>

        </tr>
        <tr>
        <td>4 </td>
        <td> </td>
        <td>8 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td>6 </td>
        <td> </td>
        <td>2 </td>
        </tr>
        <tr>
        <td> </td>
        <td>2 </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td> </td>
        <td>1 </td>
        <td> </td>
        </tr>
        <tr>
        <td> </td>
        <td> </td>
        <td>4 </td>
        <td> </td>
        <td>6 </td>
        <td>5 </td>
        <td>2 </td>
        <td> </td>
        <td>1 </td>
        <td> </td>
        <td> </td>
        </tr>
      </TableDragSelect>
}

export default App;
