(this.webpackJsonp4color=this.webpackJsonp4color||[]).push([[0],{11:function(e,t,n){e.exports=n(23)},16:function(e,t,n){},22:function(e,t,n){},23:function(e,t,n){"use strict";n.r(t);var l=n(0),a=n.n(l),r=n(9),o=n.n(r),c=(n(16),n(10)),u=n(7),d=n(1),s=n(6),i=n(3),m=n(2),E=n(4),p=n(5),h=n.n(p),f=(n(22),function(e){function t(e){var n;return Object(d.a)(this,t),(n=Object(i.a)(this,Object(m.a)(t).call(this,e))).state={inputMode:1},n}return Object(E.a)(t,e),Object(s.a)(t,[{key:"render",value:function(){var e=this;return a.a.createElement("div",{className:"game"},a.a.createElement("div",{className:"game-board"},a.a.createElement(g,{inputMode:this.state.inputMode})),a.a.createElement("div",{className:"game-controls"},a.a.createElement("div",{className:"input-mode"},a.a.createElement(v,{selected:1===this.state.inputMode,onClick:function(){return e.setState({inputMode:1})}},"Normal"),a.a.createElement(v,{selected:2===this.state.inputMode,onClick:function(){return e.setState({inputMode:2})}},"Color"))))}}]),t}(a.a.Component)),v=function(e){function t(){var e,n;Object(d.a)(this,t);for(var l=arguments.length,r=new Array(l),o=0;o<l;o++)r[o]=arguments[o];return(n=Object(i.a)(this,(e=Object(m.a)(t)).call.apply(e,[this].concat(r)))).render=function(){var e=n.props,t=e.className,l=void 0===t?"input-mode-button":t,r=e.selected,o=e.onClick;Object(u.a)(e,["className","selected","onClick"]);return r&&(l+=" selected"),a.a.createElement("button",{className:l,onClick:o},n.props.children)},n}return Object(E.a)(t,e),t}(a.a.Component),w=function(e){function t(e){var n;return Object(d.a)(this,t),(n=Object(i.a)(this,Object(m.a)(t).call(this,e))).componentDidMount=function(){window.addEventListener("mouseup",n.handleTouchEndWindow),window.addEventListener("touchend",n.handleTouchEndWindow),window.addEventListener("keydown",n.handleKeyPressWindow)},n.componentWillUnmount=function(){window.removeEventListener("mouseup",n.handleTouchEndWindow),window.removeEventListener("touchend",n.handleTouchEndWindow),window.removeEventListener("keydown",n.handleKeyPressWindow)},n.render=function(){return a.a.createElement("table",{className:"table-drag-select"},a.a.createElement("tbody",null,n.renderRows()))},n.renderRows=function(){return a.a.Children.map(n.props.children,(function(e,t){return a.a.createElement("tr",Object.assign({key:t},e.props),a.a.Children.map(e.props.children,(function(e,l){return a.a.createElement(b,Object.assign({key:l,onTouchStart:n.handleTouchStartCell,onTouchMove:n.handleTouchMoveCell,fixedValue:e.props.children,value:n.props.data[t][l].value,centerNote:n.props.data[t][l].centerNote,cornerNote:n.props.data[t][l].cornerNote,color:n.props.data[t][l].color,selected:n.props.data[t][l].selected,beingSelected:n.isCellBeingSelected(t,l)},e.props),e.props.children)})))}))},n.handleTouchStartCell=function(e){var t=0===e.button,l="mousedown"!==e.type;if(!n.state.selectionStarted&&(t||l)){N(e)||n.resetSelection(),e.preventDefault();var a=S(e),r=a.row,o=a.column;n.props.onSelectionStart({row:r,column:o}),n.setState((function(e){return{selectionStarted:!0,selection:[{row:r,column:o}]}}))}},n.handleTouchMoveCell=function(e){if(n.state.selectionStarted){e.preventDefault();var t=S(e),l=t.row,a=t.column;if(n.state.selection.some((function(e){return e.row===l&&e.column===a})))return;n.setState((function(e){return{selection:[].concat(Object(c.a)(e.selection),[{row:l,column:a}])}}))}},n.handleTouchEndWindow=function(e){var t=0===e.button,l="mousedown"!==e.type;if(n.state.selectionStarted&&(t||l)){var a=h()(n.props.data);n.state.selection.forEach((function(e){a[e.row][e.column].selected=!0})),n.setState({selectionStarted:!1}),n.props.onChange(a)}else N(e)||n.resetSelection()},n.handleKeyPressWindow=function(e){if(e.preventDefault(),null!==n.state.selection){var t=h()(n.props.data);console.log(e);var l=46===e.keyCode||8===e.keyCode,a=-1!==e.code.indexOf("Numpad"),r=e.keyCode>=48&&e.keyCode<=57||a,o=l?null:a?e.code.substring(6):String.fromCharCode(e.keyCode),c=!1;l?n.state.selection.forEach((function(e){c=!0,t[e.row][e.column].cornerNote=o,t[e.row][e.column].centerNote=o,t[e.row][e.column].value=o,t[e.row][e.column].color=o})):1===n.props.inputMode&&e.shiftKey&&r?(c=!0,n.state.selection.forEach((function(e){t[e.row][e.column].cornerNote=o}))):1===n.props.inputMode&&e.ctrlKey&&r?(c=!0,n.state.selection.forEach((function(e){t[e.row][e.column].centerNote=o}))):1===n.props.inputMode&&r?(c=!0,n.state.selection.forEach((function(e){t[e.row][e.column].value=o}))):2===n.props.inputMode&&r&&(c=!0,n.state.selection.forEach((function(e){t[e.row][e.column].color=o}))),c&&n.props.onChange(t)}},n.isCellBeingSelected=function(e,t){return n.state.selectionStarted&&n.state.selection.some((function(n){return n.row===e&&n.column===t}))},n.state={selectionStarted:!1,shouldAppend:!1,selection:[]},n}return Object(E.a)(t,e),Object(s.a)(t,[{key:"resetSelection",value:function(){for(var e=h()(this.props.data),t=0;t<e.length;t++)for(var n=0;n<e[t].length;n++)e[t][n].selected=!1;this.setState({selection:null,selectionStarted:!1}),this.props.onChange(e)}}]),t}(a.a.Component);w.defaultProps={data:{},maxRows:1/0,maxColumns:1/0,onSelectionStart:function(){},onInput:function(){},onChange:function(){}};var b=function(e){function t(){var e,n;Object(d.a)(this,t);for(var l=arguments.length,r=new Array(l),o=0;o<l;o++)r[o]=arguments[o];return(n=Object(i.a)(this,(e=Object(m.a)(t)).call.apply(e,[this].concat(r)))).shouldComponentUpdate=function(e){return n.props.beingSelected!==e.beingSelected||n.props.selected!==e.selected||n.props.value!==e.value||n.props.centerNote!==e.centerNote||n.props.cornerNote!==e.cornerNote||n.props.color!==e.color},n.componentDidMount=function(){n.td.addEventListener("touchstart",n.handleTouchStart,{passive:!1}),n.td.addEventListener("touchmove",n.handleTouchMove,{passive:!1})},n.componentWillUnmount=function(){n.td.removeEventListener("touchstart",n.handleTouchStart),n.td.removeEventListener("touchmove",n.handleTouchMove)},n.render=function(){var e,t=n.props,l=t.className,r=void 0===l?"":l,o=t.disabled,c=t.beingSelected,d=t.selected,s=(t.onTouchStart,t.onTouchMove,t.value),i=(t.cornerNote,t.centerNote,t.fixedValue),m=t.color,E=Object(u.a)(t,["className","disabled","beingSelected","selected","onTouchStart","onTouchMove","value","cornerNote","centerNote","fixedValue","color"]);return o?r+=" cell-disabled":(r+=" cell-enabled",d&&(r+=" cell-selected"),c&&(r+=" cell-being-selected"),m&&(r+=" color"+m)),i&&i.trim()?(e=i,r+=" cell-fixed-value"):e=s,a.a.createElement("td",Object.assign({ref:function(e){return n.td=e},className:r,onMouseDown:n.handleTouchStart,onMouseMove:n.handleTouchMove},E),e)},n.handleTouchStart=function(e){n.props.disabled||n.props.onTouchStart(e)},n.handleTouchMove=function(e){n.props.disabled||n.props.onTouchMove(e)},n}return Object(E.a)(t,e),t}(a.a.Component),S=function(e){var t;if(e.touches){var n=e.touches[0];t=document.elementFromPoint(n.clientX,n.clientY)}else for(t=e.target;"TD"!==t.tagName;)t=t.parentNode;return{row:t.parentNode.rowIndex,column:t.cellIndex}},N=function(e){return"input-mode-button"===e.target.className},g=function(e){function t(e){var n;Object(d.a)(this,t),(n=Object(i.a)(this,Object(m.a)(t).call(this,e))).render=function(){return a.a.createElement(w,{data:n.state.cells,inputMode:n.props.inputMode,onChange:function(e){return n.setState({cells:e})}},a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null,"1 "),a.a.createElement("td",null,"1"),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"10 "),a.a.createElement("td",null,"10 ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," 7"),a.a.createElement("td",null,"1 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null,"14 "),a.a.createElement("td",null,"3 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"9 "),a.a.createElement("td",null,"9 "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"16 "),a.a.createElement("td",null,"16 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null,"4 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"8 "),a.a.createElement("td",null,"8 "),a.a.createElement("td",null," "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"5 "),a.a.createElement("td",null,"9 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"4 ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"4 "),a.a.createElement("td",null,"7 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null,"8 "),a.a.createElement("td",null," 8"),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"  "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," 5"),a.a.createElement("td",null,"5 ")),a.a.createElement("tr",null,a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null,"3 "),a.a.createElement("td",null,"1 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," ")),a.a.createElement("tr",null,a.a.createElement("td",null,"1 "),a.a.createElement("td",null,"1 "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," "),a.a.createElement("td",null," 4"),a.a.createElement("td",null," 4"),a.a.createElement("td",null," ")))};var l=new Array(10).fill(null).map((function(){return new Array(10).fill(null).map((function(){return{selected:!1,value:null,cornerNote:null,centerNote:null,fixedValue:null}}))}));return n.state={cells:l},n}return Object(E.a)(t,e),t}(a.a.Component),C=f;Boolean("localhost"===window.location.hostname||"[::1]"===window.location.hostname||window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));o.a.render(a.a.createElement(C,null),document.getElementById("root")),"serviceWorker"in navigator&&navigator.serviceWorker.ready.then((function(e){e.unregister()}))}},[[11,1,2]]]);
//# sourceMappingURL=main.29fa68f6.chunk.js.map