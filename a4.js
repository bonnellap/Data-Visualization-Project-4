function createBaseMap(mapData, divId, svg) {
    if (!svg) {
        svg = d3.select(divId).append("svg")
            .attr("width", 400)
            .attr("height", 600);
    }

    var districts = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 164, 301, 302, 303, 306, 307, 308, 309, 355, 401, 402];
    mapData.features = mapData.features.filter(d => districts.includes(d.properties.communityDistrict));

    var proj = d3.geoMercator().fitSize([svg.attr('width'), svg.attr('height')], mapData);
    var path = d3.geoPath().projection(proj);

    svg.selectAll(".district")
        .data(mapData.features)
        .enter().append("path")
        .attr("d", path)
        .attr("class", "district")
        .style("stroke", "black")
        .style("stroke-width", 0.25)
        .append("title").text(function (d) { return d.properties.communityDistrict; });

    return svg;
}

function createDayCounts(bikeData, key) {
    return d3.nest()
        .key(d => d.day)
        .key(d => d[key])
        .rollup(arr => arr.reduce((s, d) => s + (+d.count), 0))
        .map(bikeData);
}

function createDistrictCounts(bikeData, key1, key2) {
    var districtCounts = d3.nest()
        .key(d => d[key1])
        .key(d => d[key2])
        .rollup(arr => arr.reduce((s, d) => s + (+d.count), 0))
        .map(bikeData);

    var districtTotals = d3.nest()
        .key(d => d[key2])
        .rollup(arr => arr.reduce((s, d) => s + (+d.count), 0))
        .map(bikeData);

    districtCounts.set("total", districtTotals);
    return districtCounts;
}

function createDayChoropleths(mapData, bikeData) {
    var startMap = createBaseMap(mapData, "#day-start-map");
    var endMap = createBaseMap(mapData, "#day-end-map");

    var startCounts = createDayCounts(bikeData, "startDistrict");
    var endCounts = createDayCounts(bikeData, "endDistrict");

    //slider
    var slider = document.getElementById("slider");
    var inputSlider = document.createElement("input");
    inputSlider.setAttribute("class", "input-slider");
    inputSlider.setAttribute("type", "range");
    inputSlider.setAttribute("min", "1");
    inputSlider.setAttribute("max", "31");
    inputSlider.setAttribute("step", "1");
    inputSlider.setAttribute("value", "1");
    slider.appendChild(inputSlider);

    //Text under slider
    var text = document.createElement("p");
    text.setAttribute("class", "slider-text");
    text.innerText = "Date: July " + inputSlider.value;
    slider.appendChild(text);

    // Currently just shows July 1 Data!
    // Need to update/refactor so that there is a slider such that when the slider
    // value is changed, the maps are updated to reflect that day's data
    var maxCount = Math.max(d3.max(startCounts.values(), d => d3.max(d.values())),
        d3.max(endCounts.values(), d => d3.max(d.values())));
    var dayColor = d3.scaleSequential(d3.interpolateBlues).domain([0, maxCount]);
    startMap.selectAll(".district")
        .style("fill", d => dayColor(startCounts.get(1).get(+d.properties.communityDistrict) || 0))
        .select("title").text(d => startCounts.get(1).get(+d.properties.communityDistrict));
    endMap.selectAll(".district")
        .style("fill", d => dayColor(endCounts.get(1).get(+d.properties.communityDistrict) || 0))
        .select("title").text(d => endCounts.get(1).get(+d.properties.communityDistrict));


    //Slider listener for changes
    slider.addEventListener("mousemove", function (event) {
        //Get date from slider
        var date = +inputSlider.value;
        //Set the date text
        text.innerText = "Date: July " + date;
        //Change the startMap
        startMap.selectAll(".district")
            .style("fill", d => dayColor(startCounts.get(date).get(+d.properties.communityDistrict) || 0))
            .select("title").text(d => startCounts.get(date).get(+d.properties.communityDistrict));
        //Change the endMap
        endMap.selectAll(".district")
            .style("fill", d => dayColor(endCounts.get(date).get(+d.properties.communityDistrict) || 0))
            .select("title").text(d => endCounts.get(date).get(+d.properties.communityDistrict));
    });

}

function createSourceDestLinked(mapData, bikeData) {
    var startMap = createBaseMap(mapData, "#linked-start-map");
    var endMap = createBaseMap(mapData, "#linked-end-map");

    var startCounts = createDistrictCounts(bikeData, "startDistrict", "endDistrict");
    var endCounts = createDistrictCounts(bikeData, "endDistrict", "startDistrict");

    // Currently, just shows the totals on the left and the 101 destination counts on the right
    // Need to update this so that
    //  (a) hovering over a district on the left shows the destination counts on the right
    //  (b) hovering over a district on the right shows the source counts on the left
    var colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get("total").values())]);
    startMap.selectAll(".district")
        .style("fill", d => colorLeft(startCounts.get("total").get(+d.properties.communityDistrict) || 0));

    var colorRight = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(endCounts.get(101).values())]);
    endMap.selectAll(".district")
        .style("fill", d => colorRight(startCounts.get(101).get(+d.properties.communityDistrict) || 0));

    //Add start map mouseover events
    startMap.selectAll(".district")
        .on("mouseover", startMouseOver)
        .on("mouseout", startMouseExit);

    //Add end map mouseover events
    endMap.selectAll(".district")
        .on("mouseover", endMouseOver)
        .on("mouseout", endMouseExit);

    function startMouseOver() {
        var selection = d3.select(this);
        var district = selection.data()[0].properties.communityDistrict;

        colorRight = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(district).values())]);

        //Set the stroke weight and color for the selected district
        startMap.selectAll(".district")
            .style("stroke-width", function (d) {
                if (+d.properties.communityDistrict == district) {
                    return 2;
                }
                else {
                    return 0.25;
                }
            })
            .style("stroke", function (d) {
                if (+d.properties.communityDistrict == district) {
                    return "red";
                }
                else {
                    return "black";
                }
            });

        //Color the end map based on the source district
        endMap.selectAll(".district")
            .style("fill", d => colorRight(startCounts.get(district).get(+d.properties.communityDistrict) || 0));

        selection.style("stroke", "red")
            .style("stroke-width", 2);
        
    }

    function startMouseExit() {
        //Set the stroke weight and color for the map
        startMap.selectAll(".district")
            .style("stroke-width", 0.25)
            .style("stroke", "black");
    }

    function endMouseOver() {
        var selection = d3.select(this);
        var district = selection.data()[0].properties.communityDistrict;

        colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(endCounts.get(district).values())]);

        //Set the stroke weight and color for the selected district
        endMap.selectAll(".district")
            .style("stroke-width", function (d) {
                if (+d.properties.communityDistrict == district) {
                    return 2;
                }
                else {
                    return 0.25;
                }
            })
            .style("stroke", function (d) {
                if (+d.properties.communityDistrict == district) {
                    return "red";
                }
                else {
                    return "black";
                }
            });

        //Color the start map based on the destination district
        startMap.selectAll(".district")
            .style("fill", d => colorLeft(endCounts.get(district).get(+d.properties.communityDistrict) || 0));

        selection.style("stroke", "red")
            .style("stroke-width", 2);

    }

    function endMouseExit() {
        //Set the stroke weight and color for the map
        endMap.selectAll(".district")
            .style("stroke-width", 0.25)
            .style("stroke", "black");
    }
    /*
    var s = startMap.selectAll(".district").filter(d => d.properties.communityDistrict == 101);
    s.style("stroke", "red")
        .style("stroke-width", 2);
    s.node().parentNode.appendChild(s.node());*/


    
}

function createMapNetwork(mapData, bikeData, minTrips) {
    var counts = d3.nest()
        .key(d => d.startDistrict)
        .key(d => d.endDistrict)
        .rollup(arr => arr.reduce((s, d) => s + (+d.count), 0))
        .map(bikeData);

    var nodes = counts.keys().map(d => ({ name: d }));
    var lookup = d3.map(nodes, d => d.name);
    var links = counts.entries().reduce(
        (s, d) => s.concat(d.value.entries()
            .filter(dd => ((d.key != dd.key) && (dd.value >= minTrips)))
            .map(dd => (
                {
                    source: lookup.get(d.key),
                    target: lookup.get(dd.key),
                    count: dd.value
                }))), []);

    var w = 1000;
    var h = 1000;
    var padding = 60;

    svg = d3.select("#map-network").append("svg")
        .attr("width", w)
        .attr("height", h);

    //Create edges as lines
    var edges = svg.selectAll(".link")
        .data(links)
        .enter().append("line")
        .style("stroke", "gray")
        .style("stroke-width", 1)
        .attr("class", "link");

    function dragstarted(d) {
        if (!d3.event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    var nodeGroups = svg.selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // UPDATE: create a mini map here instead of the circles
    //set the width and height of the svg maps
    var mapWidth = 100;
    var mapHeight = 100;

    //Append an svg for the maps on each node
    nodeGroups.append("svg")
        .attr("class", "map")
        .attr("width", mapWidth)
        .attr("height", mapHeight);

    //Create the maps
    createBaseMap(mapData, undefined, nodeGroups.selectAll(".map"));

    //Get the counts
    var startCounts = createDistrictCounts(bikeData, "startDistrict", "endDistrict");
    var endCounts = createDistrictCounts(bikeData, "endDistrict", "startDistrict");


    ///// I don't know if this is how I was supposed to do this, but it works
    var districts = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 164, 301, 302, 303, 306, 307, 308, 309, 355, 401, 402];
    var i = 0;
    //Basically, I add a class to each svg map with the district info
    //I could not figure out another way of getting that info from the .district selection
    nodeGroups.selectAll(".map")
        .attr("class", function () {
            i++;
            return "map " + districts[i - 1];
        });

    //Change map fill
    svg.selectAll(".map")
        .selectAll(".district")
        .style("fill", function (d) {
            //"Cheaty" bit: get the parent's class name to get its district
            var parentDistrict = +this.parentNode.className.baseVal.split(" ")[1];
            var district = +d.properties.communityDistrict;
            var colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(district).values())]);
            return colorLeft(startCounts.get(district).get(parentDistrict) || 0);
        })
        .style("stroke", function (d) {
            var parentDistrict = +this.parentNode.className.baseVal.split(" ")[1];
            if (+d.properties.communityDistrict == parentDistrict) {
                return "red";
            }
            else {
                return "black";
            }
        })
        .style("stroke-width", function (d) {
            var parentDistrict = +this.parentNode.className.baseVal.split(" ")[1];
            if (+d.properties.communityDistrict == parentDistrict) {
                return 2;
            }
            else {
                return 0.25;
            }
        });


    //Other failed attempts:

    /*
    svg.selectAll(".map")
        .select(function (d) {
            district1 = +d.name;
            console.log();
            colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(district1).values())]);
        })
        .selectAll(".district")
        .style("fill", function (d) {
            district2 = +d.name;
            console.log(district1, district2);
            return colorLeft(startCounts.get(district1).get(district2) || 0);
        });*/

    /*
    var colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get("total").values())]);
    nodeGroups.selectAll(".district")
        .style("fill", d => colorLeft(startCounts.get("total").get(+d.properties.communityDistrict) || 0));*/

    /*

    console.log(baseMap.selectAll(".district"));

    var startCounts = createDistrictCounts(bikeData, "startDistrict", "endDistrict");
    var endCounts = createDistrictCounts(bikeData, "endDistrict", "startDistrict");

    
    //var colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(district).values())]);


    nodeGroups.style("fill", function (d) {
        var colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(+d.name).values())]);
    });*/

    /*
    var colorLeft = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get("total").values())]);
    nodeGroups.selectAll(".district")
        .style("fill", d => colorLeft(startCounts.get("total").get(+d.properties.communityDistrict) || 0));*/

    /////
    /////
    /////


    /*
    var selection = d3.select(this);
    var district = selection.data()[0].properties.communityDistrict;

    var colorRight = d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(startCounts.get(district).values())]);

    //Set the stroke weight and color for the selected district
    nodeGroups.selectAll(".district")
        .style("stroke-width", function (d) {
            if (+d.properties.communityDistrict == district) {
                return 2;
            }
            else {
                return 0.25;
            }
        })
        .style("stroke", function (d) {
            if (+d.properties.communityDistrict == district) {
                return "red";
            }
            else {
                return "black";
            }
        });

    //Color the end map based on the source district
    nodeGroups.selectAll(".district")
        .style("fill", d => colorRight(startCounts.get(district).get(+d.properties.communityDistrict) || 0));

    selection.style("stroke", "red")
        .style("stroke-width", 2);*/

    //var startMap = createBaseMap(mapData, "#map-network");
    /*
    nodeGroups.append("svg")
        .attr("width", 50)
        .attr("height", 50)
        .append(function () {
            return document.createElement("svg");
        })
        .attr("class","test");*/



    
        
    //var map = createBaseMap(mapData, "#map-network", mapSvg);
    //nodeGroups.append(map);

    /*
    nodeGroups.append("circle")
        .attr("r", 10)
        .style("fill", "blue")
        .style("stroke", "black")
        .style("stroke-width", 1);*/

    // UPDATE: include collision
    var sim = d3.forceSimulation()
        .force("link", d3.forceLink().id(d => d.name))
        .force("charge", d3.forceManyBody().strength(-1000))
        .force("center", d3.forceCenter(w / 2, h / 2))
        .force("collision", d3.forceCollide().radius(mapWidth/2));

    sim.nodes(nodes)
        .on("tick", function () {
            edges.attr("x1", function (d) {
                return d.source.x;
            })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });

            nodeGroups.attr("transform", function (d) {
                return "translate(" + (d.x - mapWidth/2) + "," + (d.y - mapHeight/2) + ")";
            });
        });

    // UPDATE: include link strength
    sim.force("link")
        .links(links);
}

function createVis(data) {
    var mapData = data[0], bikeData = data[1];

    createDayChoropleths(mapData, bikeData);
    createSourceDestLinked(mapData, bikeData);
    createMapNetwork(mapData, bikeData, 750);
}

Promise.all([d3.json("https://gitcdn.xyz/repo/dakoop/fb4d65af84db0ee3f2233e02cdeb1874/raw/9a819d894ff29f786b61b7c3d0fa18f84b244362/nyc-community-districts.geojson"),
d3.csv('https://gitcdn.xyz/repo/dakoop/69f3c7132f4319c62a296897a2f83d0c/raw/995bed69e03fc2d91fc62ed8530c2df6061db716/bikeTripData.csv')])
    .then(createVis);