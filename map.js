var debug;

const CONFIG = {
  default: {
    topoURL: 'data/topo-precincts.json',
    topoObjects: 'precincts',
    featureKey: 'PRECINCT',
    googleApiKey: 'AIzaSyBbFRkJQyz2Vq7p6cMM8TxbTxJjhlKAGMM',
    googleClientId: '347410550467-7dln585kevabrvj7hkmu6mronb40hvof.apps.googleusercontent.com',
    sheetId: '1PBW_ndyLJl70TCJ3i00iQGYoo0it28qKvsA2_BSMbWY',
    sheetRange: 'map_data!B1:C',
    scaleType: 'numeric',
    // California Albers https://bl.ocks.org/mbostock/5562380
    projection: d3.geoAlbers()
      .parallels([34, 40.5])
      .rotate([120, 0]),
  },

  ca45: {
    sheetId: '1Flx8mqYV6Iuh0UOvKzeLVGqXjNlX9HE29ogOn9nU4c4',
    sheetRange: 'map_data!B1:C',
  },

  az: {
    topoDocId: '1LNc8RBq3g5ONgeuoKHU8pa1TFTC39It5',
    topoObjects: 'az_2018_precincts',
    topoURL: null,
    //geoDocId: '1BAURFHwGlWJyatOOBl-sA1MaEpXmkldP',
    featureKey: 'GISPRECINC',
    sheetId: '1Y4tnSa0Zx8tWRPzoNGnPgMazXE9CCB5CywjaABKJDI0',
    sheetRange: 'az_turf_map!A2:C',
    scaleType: 'ordinal',
    // already projected
    projection: d3.geoIdentity()
  }
};

const match = window.location.href.match(new RegExp(/v=(\w+)/));
const configKey = match && CONFIG[match[1]] ? match[1] : 'default';
const config = Object.assign(CONFIG.default, CONFIG[configKey]);

const dataPromises = [];

/*
  - start loading geo data immediately if it's a URL
  - do Google Auth if needed
  - load fill color (sheet data) from Sheets API
  - load topo data from Drive API
  - when both data sets loaded, draw map
*/

// start loading geodata
if (config.topoURL) {
  dataPromises.push(d3.json(config.topoURL));
} else {
  dataPromises[0] = null;  // placeholder
}

const nonWord = new RegExp('[\W ]', 'g');
const cssId  = function(val) {
  return val.replace(nonWord, '-');
};

const drawMap = function(geojson, values, labels) {
  const container = d3.select('#map');
  const margin = 20;
  const width = window.innerWidth - (margin * 2);
  const height = window.innerHeight - (margin * 2);

  // https://bl.ocks.org/iamkevinv/0a24e9126cd2fa6b283c6f2d774b69a2
  const zoomed = function() {
    d3.select('svg g').attr('transform', d3.event.transform);
  }
  const zoom = d3.zoom()
    .scaleExtent([1, 100])
    .on('zoom', zoomed)

  const svg = container.append('svg')
    .attr('height', height)
    .attr('width', width);
  svg.call(zoom);

  const projection = config.projection
    .fitSize([width - (2 * margin), height - (2 * margin)], geojson);

  const geoGenerator = d3.geoPath()
    .projection(projection);

  let color;
  if (config.scaleType == 'ordinal') {
    let uniq = Array.from(new Set(Object.values(values))).sort();

    if (uniq[0] == '') {
      uniq = uniq.slice(1);
    }
    // https://jnnnnn.blogspot.com/2017/02/distinct-colours-2.html
    const colors = [
      '#1b70fc', '#faff16', '#d50527', '#158940', '#f898fd', '#24c9d7', '#cb9b64',
      '#866888', '#22e67a', '#e509ae', '#9dabfa', '#437e8a', '#b21bff', '#ff7b91',
      '#94aa05', '#ac5906', '#82a68d', '#fe6616', '#7a7352', '#f9bc0f', '#b65d66',
      '#07a2e6', '#c091ae', '#8a91a7', '#88fc07', '#ea42fe', '#9e8010', '#10b437',
      '#c281fe', '#f92b75', '#07c99d', '#a946aa', '#bfd544', '#16977e', '#ff6ac8',
      '#a88178', '#5776a9', '#678007', '#fa9316', '#85c070'
    ];
    color = d3.scaleOrdinal()
      .range(colors)
      .domain(uniq);
  } else {
    // https://github.com/d3/d3-scale-chromatic
    color = d3.scaleSequential(d3.interpolateGnBu);
  }

  const tooltip = d3.select('body').append('div')
    .attr('class', 'map-tooltip')
    .style('opacity', 0);

  const map = svg.append('g')
    .attr('class', 'precincts')
    .selectAll('path')
    .data(geojson.features)
    .enter()
    .append('path')
    .attr('d', geoGenerator)
    .attr('id', d => `p${cssId(d.properties[config.featureKey])}`)
    .attr('fill', (d) => {
      const key = d.properties[config.featureKey];
      if (!(key in values)) {
        console.log(`${key} missing`);
      }
      return key in values ? color(values[key]) : '#eee';
    })
    .attr('stroke', '#000')
    .attr('stroke-width', 0.5)
    .on('mouseover', (d) => {
      const key = d.properties[config.featureKey];
      const label = labels[key] || key;
      let val = key in values ? values[key] : 'N/A';

      if (config.scaleType == 'numeric' && val !== 'N/A') {
        val = `${Math.round(val * 100)}%`;
      } else if (!val) {
        val = 'N/A';
      }
      const html = `${label}: ${val}`;
      tooltip.transition()
        .duration(200)
        .style('opacity', .95)
        .style('height', html.length > 18 ? '40px' : '20px');
      tooltip.html(html)
        .style('left', (d3.event.pageX) + 'px')
        .style('top', (d3.event.pageY - 28) + 'px');
      d3.select(`#p${cssId(key)}`)
        .attr('stroke', '#0000ff')
        .attr('stroke-width', 2);
    })
    .on('mouseout', (d) => {
      d3.selectAll('.precincts path')
        .attr('stroke', '#000')
        .attr('stroke-width', 0.5)
      tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    });

  if (config.scaleType == 'numeric') {
    // https://bl.ocks.org/OliverWS/c1f4c521cae9f379c95ace6edc1c5e30
    const legendWidth = 300;
    const x = d3.scaleLinear()
      .domain([0, 100])
      .rangeRound([width - 50 - legendWidth, width - 50]);
    const legend = svg.append('g')
      .attr('class', 'key')
      .attr('transform', 'translate(0,40)');

    const bars = [];
    for (let i = 0; i < 100; i++) {
      bars.push(i);
    }
    legend.selectAll('rect')
      .data(bars)
      .enter().append('rect')
        .attr('height', 8)
        .attr('x', d => x(d))
        .attr('width', legendWidth / bars.length)
        .attr('fill', d => color(d/100.0));

    legend.append('text')
      .attr('class', 'caption')
      .attr('x', x.range()[0])
      .attr('y', -6)
      .attr('fill', '#000')
      .attr('text-anchor', 'start')
      .attr('font-weight', 'bold');

    legend.call(d3.axisBottom(x)
        .tickSize(13)
        .tickFormat(x => `${x}%`)
        .tickValues(x.ticks(11)))
      .select('.domain')
        .remove();
  }
};

const processData = function(data) {
  let [geo, sheet] = data;
  const values = {};
  const labels = {};

  if (config.topoDocId || config.geoDocId) {
    // parse string data from Google Drive API
    geo = JSON.parse(geo.body);
  }
  // geoDocId is already geoJSON
  // otherwise convert topoJSON to geoJSON
  const geojson = config.geoDocId ? geo : topojson.feature(geo, geo.objects[config.topoObjects]);

  sheet.result.values.forEach((row) => {
    // id, value, [label]
    const id = row[0]
    let val = row[1];
    // if it looks like a number, try to parse it
    if (val.match(/^[\d\.%]+$/)) {
      try {
        val = Number.parseFloat(val.replace('%', '')) / 100;
      } catch (e) {
        console.error('error parsing row', row);
        return;
      }
    }
    values[id] = val;
    if (row.length > 2) {
      labels[id] = row[2];
    }
  });
  debug = values;
  drawMap(geojson, values, labels);
};

/***
  Google auth for Sheets and Drive API
  https://developers.google.com/sheets/api/quickstart/js
***/

const loadGoogleData = function() {
  const docId = config.topoDocId || config.geoDocId;
  if (docId) {
    //  authorized HTTP GET request to the file's resource URL and include the query parameter alt=media
    dataPromises[0] = gapi.client.drive.files.get({
      fileId: docId,
      alt: 'media',
    });
  }
  dataPromises.push(gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: config.sheetRange,
  }));
  Promise.all(dataPromises).then(processData).catch((e) => {
    $('.error .alert').text(`error: ${e.result.error.message}`);
    $('.error').show();
    $('.error .alert').show();
  });
};

const updateSigninStatus = function(isSignedIn) {
  $('.error').hide();
  if (isSignedIn) {
    $('#googleAuthorize').hide();
    $('#googleSignout').show();
    $('.alert').hide()
    loadGoogleData();
  } else {
    $('#googleAuthorize').show();
    $('#googleSignout').hide();
    $('.alert').show()
  }
};

const initGoogleClient = function() {
  gapi.client.init({
    apiKey: config.googleApiKey,
    clientId: config.googleClientId,
    discoveryDocs: [
      'https://sheets.googleapis.com/$discovery/rest?version=v4',
      'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    ],
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly'
  }).then(function () {
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    $('#googleAuthorize').on('click', function() {
      gapi.auth2.getAuthInstance().signIn();
    });
    $('#googleSignout').on('click', function() {
      gapi.auth2.getAuthInstance().signOut();
    });
  }).catch(function (e) {
    $('.error .alert').text(`error: ${e.details}`);
    $('.error').show();
  });
};

/***
  load data
***/
/*
d3.queue()
  .defer(d3.json, 'data/topo-precincts.json')  // precincts in topoJSON
  .defer(d3.csv, 'data/sample.csv')  // Id,City,Total
  .await(function (err, geojson, csv) {
    if (err) {
      console.error(err);
      return;
    }
    drawMap(geojson, csv);
  });
*/
