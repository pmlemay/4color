import React from 'react';
import clone from "clone";
import PropTypes from "prop-types";
import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    let numberOfRows = 4;
    let numberOfColumns = 5;
    let gridData = new Array(numberOfRows).fill((null)).map(() => new Array(numberOfColumns).fill(null).map(() => (
      {
        selected: false,
        value: null,
        cornerNote: null,
        centerNote: null,
        fixedValue: null
      })));

    this.state = {
      data: gridData,
      inputMode: 1,
      numberOfRows: numberOfRows,
      numberOfColumns: numberOfColumns,
      selection: []
    };
  }

  render() {
    return (
      <div className="game">
        <div className="game-board">
          <Board
            numberOfRows = {this.state.numberOfRows}
            numberOfColumns = {this.state.numberOfColumns}
            data = {this.state.data}
            inputMode={this.state.inputMode}
            selection = {this.state.selection}
            onChange={(data, selection) => {
              this.setState({data, selection})}
            }
            />
        </div>
        <div className="game-controls">
          <div className='input-modes'>
            <InputMode 
              selected={this.state.inputMode === 1}
              onClick={() => this.setState({ inputMode: 1 })}
              >
              Normal
            </InputMode>
            <InputMode 
              selected={this.state.inputMode === 2}
              onClick={() => this.setState({ inputMode: 2 })}
              >
              Color
            </InputMode>
          </div>
          <div className='input-controls'>
            <InputControl
              input='*'
              data={this.state.data}
              selection = {this.state.selection}
              onChange={data => this.setState({data})}
              >
            </InputControl>
          </div>
        </div>
      </div>
    );
  }
}

class InputControl extends React.Component {
  constructor(props) {
    super(props);
  }

  handleInputClicked = (input) => {
    const data = clone(this.props.data);

    this.props.selection.forEach(element => {
      data[element.row][element.column].value = input
    });
    this.props.onChange(data);
  };

  render = () => {
    let {
      className = "input-control-button",
    } = this.props;

    return (
      <button 
        className={className}
        onClick={() => this.handleInputClicked(this.props.input)}
        > 
        {this.props.input}
      </button>
    );
  };
}

class InputMode extends React.Component {
  render = () => {
    let {
      className = "input-mode-button",
      selected,
      onClick
    } = this.props;
    if(selected) {
      className += " selected";
    }
    return (
      <button 
        className={className}
        onClick={onClick}> 
        {this.props.children}
      </button>
    );
  };
}

class TableDragSelect extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectionStarted: false,
      shouldAppend: false,
      ctrlKeyIsPressed: false,
    };
  }

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

  componentDidMount = () => {
    window.addEventListener("mouseup", this.handleTouchEndWindow);
    window.addEventListener("touchend", this.handleTouchEndWindow);
    window.addEventListener("keydown", this.handleKeyPressWindow);
    window.addEventListener("keyup", this.handleKeyUpWindow);
  };

  componentWillUnmount = () => {
    window.removeEventListener("mouseup", this.handleTouchEndWindow);
    window.removeEventListener("touchend", this.handleTouchEndWindow);
    window.removeEventListener("keydown", this.handleKeyPressWindow);
    window.removeEventListener("keyup", this.handleKeyUpWindow);
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
              color={this.props.data[i][j].color}
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
    if(this.state.ctrlKeyIsPressed) return;

    const data = clone(this.props.data);
    for(let i = 0; i < data.length; i++)
    {
      for(let j = 0; j < data[i].length; j++)
      {
        data[i][j].selected = false;
      }
    }
    this.setState({ selectionStarted: false });
    var selection = clone(this.props.selection);
    selection = [];
    this.props.onChange(data, selection); 
  }
  
  handleTouchStartCell = e => {
    const isLeftClick = e.button === 0;
    const isTouch = e.type !== "mousedown";
    if (!this.state.selectionStarted && (isLeftClick || isTouch)) {
      if(!this.eventIsInputButton(e)){
        this.resetSelection();
      }
      e.preventDefault();
      const { row, column } = this.eventToCellLocation(e);
      this.props.onSelectionStart({ row, column });
      this.setState(prevState => ({
        selectionStarted: true,
      }));

      var selection = clone(this.props.selection);
      selection = [{ row, column }];
      this.props.onChange(this.props.data, selection);
    }
  };

  handleTouchMoveCell = e => {
    if (this.state.selectionStarted) {
      e.preventDefault();
      const { row, column } = this.eventToCellLocation(e);
      // Do nothing if we already added that cell to the selection
      if(this.props.selection.some(e => e.row === row && e.column === column)) return;

      var selection = clone(this.props.selection);
      selection = [...selection, { row, column }];
      this.props.onChange(this.props.data, selection);
    }
  };

  handleTouchEndWindow = e => {
    const isLeftClick = e.button === 0;
    const isTouch = e.type !== "mousedown";
    if (this.state.selectionStarted && (isLeftClick || isTouch)) {
      const data = clone(this.props.data);
      this.props.selection.forEach(element => {
        data[element.row][element.column].selected = true;
      });
      this.setState({ selectionStarted: false });
      this.props.onChange(data, this.props.selection);
    }
    else{
      if(!this.eventIsInputButton(e)){
        this.resetSelection();
      }
    }
  };

  handleKeyUpWindow = e => {
    this.setState({ctrlKeyIsPressed: e.ctrlKey})
  };

  handleKeyPressWindow = e => {
    e.preventDefault();
    if (this.props.selection === null) return;
    this.setState({ctrlKeyIsPressed: e.ctrlKey})

    const data = clone(this.props.data);

    let shouldDelete = e.keyCode === 46 || e.keyCode === 8;
    let isNumpadNumber = e.code.indexOf("Numpad") !== -1
    let isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || isNumpadNumber;
    let valueToInsert = shouldDelete ? null : isNumpadNumber ? e.code.substring(6) : String.fromCharCode(e.keyCode);

    let shouldUpdateData = false;
    // Delete
    if(shouldDelete)
    {
      this.props.selection.forEach(element => {
        shouldUpdateData = true;
        data[element.row][element.column].cornerNote = valueToInsert
        data[element.row][element.column].centerNote = valueToInsert
        data[element.row][element.column].value = valueToInsert
        data[element.row][element.column].color = valueToInsert
      });
    }
    // Shift + Number
    else if (this.props.inputMode === 1 && e.shiftKey && isNumber) {
      shouldUpdateData = true;
      this.props.selection.forEach(element => {
        data[element.row][element.column].cornerNote = valueToInsert
      });
    }
     // Control + Number
    else if (this.props.inputMode === 1 && e.ctrlKey && isNumber) {
      shouldUpdateData = true;
      this.props.selection.forEach(element => {
        data[element.row][element.column].centerNote = valueToInsert
      });
    }
    // Number
    else if (this.props.inputMode === 1 && isNumber) {
      shouldUpdateData = true;
      this.props.selection.forEach(element => {
        data[element.row][element.column].value = valueToInsert
      });
    }
    // Color
    else if (this.props.inputMode === 2 && isNumber) {
      shouldUpdateData = true;
      this.props.selection.forEach(element => {
        data[element.row][element.column].color = valueToInsert
      });
    }
    
    if(shouldUpdateData){
      this.props.onChange(data, this.props.selection);
    }
  };

  isCellBeingSelected = (row, column) => {
    return this.state.selectionStarted && this.props.selection.some(e => e.row === row && e.column === column);
  };
  
  eventIsInputButton = e => {
    return e.target.closest(".game-controls")
  };

  // Takes a mouse or touch event and returns the corresponding row and cell.
  // Example:
  // eventToCellLocation(event);
  // returns {row: 2, column: 3}
  eventToCellLocation = e => {
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
}

class Cell extends React.Component {
  // This optimization gave a 10% performance boost while drag-selecting cells
  shouldComponentUpdate = nextProps =>
    this.props.beingSelected !== nextProps.beingSelected ||
    this.props.selected !== nextProps.selected ||
    this.props.value !== nextProps.value ||
    this.props.centerNote !== nextProps.centerNote ||
    this.props.cornerNote !== nextProps.cornerNote ||
    this.props.color !== nextProps.color;

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
      innerDivClassName = "",
      disabled,
      beingSelected,
      selected,
      onTouchStart,
      onTouchMove,
      value,
      cornerNote,
      centerNote,
      fixedValue,
      color,
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
      if (color) {
        innerDivClassName += " color" + color;
      }
    }

    let cellValue;
    if(fixedValue && fixedValue.trim())
    {
      cellValue = fixedValue;
      innerDivClassName += " cell-fixed-value";
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
        <div className={innerDivClassName}>{cellValue}</div>
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

class Board extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      // galaxies: [
      //   {i:1,j:2},
      //   {i:2,j:12},{i:2,j:19},
      //   {i:3,j:3},{i:3,j:9},{i:3,j:16},
      //   {i:5,j:5},
      //   {i:9,j:3},{i:9,j:14},{i:9,j:19},
      //   {i:10,j:7},{i:10,j:10},{i:10,j:17},
      //   {i:12,j:3},
      //   {i:15,j:1},{i:15,j:13},
      //   {i:17,j:3},{i:17,j:18},
      //   {i:18,j:8},
      //   {i:19,j:16}
      // ]
    };
  }

  render = () => {
    if(this.state.galaxies){
      var galaxyMapping = this.state.galaxies.map(({i, j}, index) => {
        // PointerEvents set to none so that we can click through to cells
        const galaxyStyle = {top: i * 26.5, left: j * 26.5, 'pointerEvents': 'none'}
        return <div key={index} className='galaxy' style={galaxyStyle}></div>
      });
    }

    var rows = new Array(this.props.numberOfRows);
    var columns = new Array(this.props.numberOfColumns);
    var elements = [];
    for (var i=0; i < rows.length; i++){
      var cells = [];
      for (var j=0; j < columns.length; j++){
        cells.push(<td key={j}>{columns[j]}</td>);
      }
      elements.push(<tr key={i}>{cells}</tr>);
    }

    return <div className="container">
      <div className='grid'>
        {galaxyMapping}
        <TableDragSelect
          data={this.props.data}
          selection={this.props.selection}
          inputMode={this.props.inputMode}
          onChange={(data, selection) => {
            this.props.onChange(data, selection)}
          }
        >
          {elements}
        </TableDragSelect>
      </div>
    </div>
  }
}

export default App;
