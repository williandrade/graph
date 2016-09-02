/**
* this demo shows one possible way of implementing "area" selection with webgl
* renderer
*/
function onLoad() {

  var graph = Viva.Graph.graph();

  var layout = Viva.Graph.Layout.forceDirected(graph, {
    springLength: 200,
    gravity : -50
  });

  graph.addNode(0)
  layout.pinNode(graph.getNode(0), true);
  for (i = 1; i <= 6 ; i++){
    graph.addNode(i);
  }

  graph.addLink(0,1);
  graph.addLink(0,1);
  graph.addLink(0,1);
  graph.addLink(0,1);
  graph.addLink(0,1);
  graph.addLink(0,1);
  graph.addLink(1,2);
  graph.addLink(0,1);
  graph.addLink(1,0);


  var graphics = Viva.Graph.View.webglGraphics();

  graphics.link(function(link){
    return Viva.Graph.View.webglLine();
  });

  var renderer = Viva.Graph.View.renderer(graph, {
    layout : layout,
    graphics : graphics,
    renderLinks : true
  });
  renderer.run();

}
