import React from 'react';
import TableDragSelect from "react-table-drag-select";
import './App.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      history: [
        {
          squares: Array(9).fill(null)
        }
      ],
      stepNumber: 0,
    };
  }

  handleClick(i) {
    const history = this.state.history.slice(0, this.state.stepNumber + 1);
    const current = history[history.length - 1];
    const squares = current.squares.slice();
    squares[i] = this.state.xIsNext ? "X" : "O";
    this.setState({
      history: history.concat([
        {
          squares: squares
        }
      ]),
      stepNumber: history.length,
      xIsNext: !this.state.xIsNext
    });
  }

  render() {
    const history = this.state.history;
    const current = history[this.state.stepNumber];

    return (
      <div className="game">
        <div className="game-board">
          <Board
            squares={current.squares}
            onClick={i => this.handleClick(i)}
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

class Board extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      cells: [
        Array(225).fill(false)
      ],
    };
  }

  renderSquare(i) {
    return (
      <Square/>
    );
  }

  render() {
    return (
      <TableDragSelect 
        value={this.state.cells}
        onChange={cells => this.setState({ cells })}>
      <tr>
        <td> 7 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 6 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 1 </td>
        <td> {this.renderSquare()} </td>
        <td> 11 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 1 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 8 </td>
      </tr>
      <tr>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 4 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 6 </td>
        <td> {this.renderSquare()} </td>
        <td> 6 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 4 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 4 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 7 </td>
        <td> {this.renderSquare()} </td>
        <td> 2 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 2 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> 2 </td>
        <td> 1 </td>
        <td> 4 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 12 </td>
        <td> {this.renderSquare()} </td>
        <td> 2 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 1 </td>
        <td> 4 </td>
        <td> 6 </td>
      </tr>
      <tr>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> 3 </td>
        <td> 4 </td>
        <td> 4 </td>
        <td> 5 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 3 </td>
        <td> 8 </td>
        <td> 6 </td>
        <td> 1 </td>
      </tr>
      <tr>
       <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> 3 </td>
        <td> 7 </td>
        <td> 7 </td>
        <td> 5 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 5 </td>
        <td> 4 </td>
        <td> 4 </td>
        <td> 11 </td>
      </tr>
      <tr>
      <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
      <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
      </tr>
      <tr>
        <td> 1 </td>
        <td> 2 </td>
        <td> 5 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 3 </td>
        <td> {this.renderSquare()} </td>
        <td> 5 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> 12 </td>
        <td> 12 </td>
        <td> 12 </td>
      </tr>
      <tr>
      <td> {this.renderSquare()} </td>
      <td> {this.renderSquare()} </td>
      <td> {this.renderSquare()} </td>
        <td> 1 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 3 </td>
        <td> {this.renderSquare()} </td>

        <td> 2 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 12 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

      </tr>
      <tr>
      <td> {this.renderSquare()} </td>
      <td> {this.renderSquare()} </td>
      <td> {this.renderSquare()} </td>

        <td> 9 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 5 </td>
        <td> {this.renderSquare()} </td>
        <td> 2 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 12 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

      </tr>
      <tr>
        <td> 6 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 6 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 4 </td>
        <td> {this.renderSquare()} </td>

        <td> 4 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 12 </td>
        <td> {this.renderSquare()} </td>
        <td> {this.renderSquare()} </td>

        <td> 12 </td>
      </tr>
      </TableDragSelect>
    );
  }
}

export default App;
