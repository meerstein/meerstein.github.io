// set up SVG for D3
const width = 960;
const height = 500;
const colors = d3.scaleOrdinal(d3.schemeCategory10);

const chooseColor = function(d) {
  let color = d.dummy ? d3.rgb(255, 255, 255) : colors(d.id);
  if (d === selectedNode) {
    return d3.rgb(color).brighter().toString();
  }
  return color;
}

const svg = d3.select('#graph')
  .append('svg')
  .attr('oncontextmenu', 'return false;')
  .attr('width', window.innerWidth)
  .attr('height', window.innerHeight - 100);

// set up initial nodes and links
//  - nodes are known by 'id', not by index in array.
//  - links are always source < target; edge directions are set by 'left' and 'right'.
const example1Nodes = [
  { id: 0, x: width / 2, y: height / 2, dummy: false},
  { id: 1, x: width / 3, y: height / 3, dummy: false},
  { id: 2, x: 2 * width / 3, y: height / 3, dummy: false},
  { id: 3, x: 2 * width / 3, y: 2 * height / 3, dummy: false},
  { id: 4, x: 2.5 * width / 3, y: 0.5 * height / 3, dummy: false}
];
const example1LastNodeId = 4;
const example1Links = [
  { source: 0, target: 1, left: false, right: true},
  { source: 1, target: 2, left: true, right: false},
  { source: 0, target: 2, left: false, right: true},
  { source: 2, target: 3, left: false, right: true},
  { source: 1, target: 4, left: true, right: false},
  { source: 3, target: 4, left: true, right: false},
];

let nodes = JSON.parse(JSON.stringify(example1Nodes));
let lastNodeId = example1LastNodeId;
let links = makeLinksByExample(example1Links, nodes);

function makeLinksByExample(exampleLinks, nodes) {
  const result = [];
  for (let link of exampleLinks) {
    const newLink = JSON.parse(JSON.stringify(link));
    newLink.source = nodes[link.source];
    newLink.target = nodes[link.target];    
    result.push(newLink)
  }
  return result;
}

function sugiyamaWrapper() {
  const withDummyCheckbox = document.getElementById("dummy");
  [nodes, links] = sugiyama(nodes, links, withDummyCheckbox.checked);
  restart();
}

document.getElementById("layout-button").onclick = () => sugiyamaWrapper();
document.getElementById("clear-button").onclick = function() {
  nodes.length = 0;
  links.length = 0;
  restart();
}
document.getElementById("example1-button").onclick = function() {
  nodes = JSON.parse(JSON.stringify(example1Nodes));
  lastNodeId = example1LastNodeId;
  links = makeLinksByExample(example1Links, nodes);
  restart();
}

// init D3 drag support
const drag = d3.drag()
  .on('start', (d) => {
    //if (!d3.event.active) {
    //  force.alphaTarget(0.3).restart();
    //}

    d.fx = d.x;
    d.fy = d.y;
  })
  .on('drag', (d) => {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  })
  .on('end', (d) => {
    //if (!d3.event.active) {
    //  force.alphaTarget(0);
    //}

    d.fx = null;
    d.fy = null;
  });

// define arrow markers for graph links
svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#000');

svg.append('svg:defs').append('svg:marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 4)
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M10,-5L0,0L10,5')
    .attr('fill', '#000');

// line displayed when dragging new nodes
const dragLine = svg.append('svg:path')
  .attr('class', 'link dragline hidden')
  .attr('d', 'M0,0L0,0');

// handles to link and node element groups
let path = svg.append('svg:g').selectAll('path');
let circle = svg.append('svg:g').selectAll('g');

// mouse event vars
let selectedNode = null;
let selectedLink = null;
let mousedownLink = null;
let mousedownNode = null;
let mouseupNode = null;

function resetMouseVars() {
  mousedownNode = null;
  mouseupNode = null;
  mousedownLink = null;
}

// update force layout (called automatically each iteration)
function tick() {
  // draw directed edges with proper padding from node centers
  path.attr('d', (d) => {
    const deltaX = d.target.x - d.source.x;
    const deltaY = d.target.y - d.source.y;
    const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const normX = deltaX / dist;
    const normY = deltaY / dist;
    const sourcePadding = d.left ? 17 : 12;
    const targetPadding = d.right ? 17 : 12;
    const sourceX = d.source.x + (sourcePadding * normX);
    const sourceY = d.source.y + (sourcePadding * normY);
    const targetX = d.target.x - (targetPadding * normX);
    const targetY = d.target.y - (targetPadding * normY);

    return `M${sourceX},${sourceY}L${targetX},${targetY}`;
  });

  circle.attr('transform', (d) => `translate(${d.x},${d.y})`);
}

// update graph (called when needed)
function restart() {
  // path (link) group
  path = path.data(links);

  // update existing links
  path.classed('selected', (d) => d === selectedLink)
    .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
    .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '');

  // remove old links
  path.exit().remove();

  // add new links
  path = path.enter().append('svg:path')
    .attr('class', 'link')
    .classed('selected', (d) => d === selectedLink)
    .style('marker-start', (d) => d.left ? 'url(#start-arrow)' : '')
    .style('marker-end', (d) => d.right ? 'url(#end-arrow)' : '')
    .on('mousedown', (d) => {
      //if (d3.event.ctrlKey) return;

      // select link
      mousedownLink = d;
      selectedLink = (mousedownLink === selectedLink) ? null : mousedownLink;
      selectedNode = null;
      restart();
    })
    .merge(path);

  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, (d) => d.id);

  // update existing nodes (selected visual states)
  circle.selectAll('circle')
    .style('fill', chooseColor)

  // remove old nodes
  circle.exit().remove();

  // add new nodes
  const g = circle.enter().append('svg:g');

  g.append('svg:circle')
    .attr('class', 'node')
    .attr('r', 12)
    .style('fill', chooseColor)
    .style('stroke', (d) => d3.rgb(colors(d.id)).darker().toString())
    .on('mouseover', function (d) {
      if (!mousedownNode || d === mousedownNode) return;
      // enlarge target node
      d3.select(this).attr('transform', 'scale(1.1)');
    })
    .on('mouseout', function (d) {
      if (!mousedownNode || d === mousedownNode) return;
      // unenlarge target node
      d3.select(this).attr('transform', '');
    })
    .on('mousedown', (d) => {
      //if (d3.event.ctrlKey) return;

      // select node
      mousedownNode = d;
      selectedNode = (mousedownNode === selectedNode) ? null : mousedownNode;
      selectedLink = null;

      // reposition drag line
      dragLine
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', `M${mousedownNode.x},${mousedownNode.y}L${mousedownNode.x},${mousedownNode.y}`);

      restart();
    })
    .on('mouseup', function (d) {
      if (!mousedownNode) return;

      // needed by FF
      dragLine
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseupNode = d;
      if (mouseupNode === mousedownNode) {
        resetMouseVars();
        return;
      }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans
      const isRight = mousedownNode.id < mouseupNode.id;
      const source = isRight ? mousedownNode : mouseupNode;
      const target = isRight ? mouseupNode : mousedownNode;

      const link = links.filter((l) => l.source === source && l.target === target)[0];
      if (link) {
        link[isRight ? 'right' : 'left'] = true;
      } else {
        links.push({ source, target, left: !isRight, right: isRight});
      }

      // select new link
      selectedLink = link;
      selectedNode = null;
      restart();
    });

  // show node IDs
  g.append('svg:text')
    .attr('x', 0)
    .attr('y', 4)
    .attr('class', 'id')
    .text((d) => d.id);

  circle = g.merge(circle);

  tick();

  // set the graph in motion
  // force
  //   .nodes(nodes)
  //   .force('link').links(links);

  // force.alphaTarget(0.3).restart();
}

function mousedown() {
  // because :active only works in WebKit?
  svg.classed('active', true);

  if (mousedownNode || mousedownLink) return;

  // insert new node at point
  const point = d3.mouse(this);
  const node = { id: ++lastNodeId, x: point[0], y: point[1],  dummy: false };
  nodes.push(node);

  restart();
}

function mousemove() {
  if (!mousedownNode) return;

  // update drag line
  dragLine.attr('d', `M${mousedownNode.x},${mousedownNode.y}L${d3.mouse(this)[0]},${d3.mouse(this)[1]}`);

  restart();
}

function mouseup() {
  if (mousedownNode) {
    // hide drag line
    dragLine
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function spliceLinksForNode(node) {
  const toSplice = links.filter((l) => l.source === node || l.target === node);
  for (const l of toSplice) {
    links.splice(links.indexOf(l), 1);
  }
}

// only respond once per keydown
let lastKeyDown = -1;

function keydown() {
  d3.event.preventDefault();

  if (lastKeyDown !== -1) return;
  lastKeyDown = d3.event.keyCode;

  // ctrl
  // if (d3.event.keyCode === 17) {
  //   circle.call(drag);
  //   svg.classed('ctrl', true);
  // }

  if (d3.event.keyCode == 83) { // S
    sugiyamaWrapper();
    return;
  }

  if (!selectedNode && !selectedLink) return;

  switch (d3.event.keyCode) {
    case 8: // backspace
    case 46: // delete
      if (selectedNode) {
        nodes.splice(nodes.indexOf(selectedNode), 1);
        spliceLinksForNode(selectedNode);
      } else if (selectedLink) {
        links.splice(links.indexOf(selectedLink), 1);
      }
      selectedLink = null;
      selectedNode = null;
      restart();
      break;
    case 67: // C
      if (selectedLink) {
        selectedLink.left = !selectedLink.left;
        selectedLink.right = !selectedLink.right;
      }
      restart();
      break;
  }
}

function keyup() {
  lastKeyDown = -1;

  // ctrl
  // if (d3.event.keyCode === 17) {
  //   circle.on('.drag', null);
  //   svg.classed('ctrl', false);
  // }
}

// app starts here
svg.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
restart();