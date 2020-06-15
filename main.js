/* eslint-disable require-jsdoc */
const {google} = require('googleapis');
const youtube = google.youtube({
  version: 'v3',
  auth: 'AIzaSyA6HvzgHv3bjb4nle6YRYVcJswZC27x9yw', // specify your API key here
});
const path = require('path');
const {authenticate} = require('@google-cloud/local-auth');

const sheets = google.sheets('v4');
const spreadsheetId = '1vm11uMVj1433Rl7Q8T_W9pQgvg0Aqb8iB8WcwKH41ow';
const solver = require('javascript-lp-solver');

const range = 'Debug!A1:E';
const input = 'Вхідні дані!B1:F3';
// const output = 'Result!A1:L';
const model = {
  optimize: 'views',
  opType: 'max',
  constraints: {
    budget: {
      max: 0,
    },
  },
  variables: {},
  ints: {},
};

async function initialize() {
  const auth = await authenticate({
    keyfilePath: path.join(__dirname, './oauth2.keys.json'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  google.options({
    auth,
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.
    // The A1 notation of the values to retrieve.
    range: input, // TODO: Update placeholder value.
  };

  try {
    const response = (await sheets.spreadsheets.values.get(request)).data;
    console.log(response.values);
    const price = response.values[1];
    const names = response.values[0];
    const maxBudget = response.values[2][0];
    const reqs = [];


    console.log(names);
    model.constraints.budget.max = parseInt(maxBudget, 10);
    for (const item of names) {
      model.variables[names.indexOf(item)] = {
        'budget': parseInt(price[names.indexOf(item)], 10),
        [names.indexOf(item)]: 1,
        'names': item,
      };
      model.ints[names.indexOf(item)] = 1;
      const uploadsId = await getUploads(item);
      const ids = await getVideos(uploadsId);
      await delay();
      const statistics = await getStats(ids);
      const views = (await getViews(statistics));
      const viewIndex = [names.indexOf(item), views, names.length];
      await setModel(viewIndex);
      // console.log(model.variables);
    }
    await delay();
    const reqq = await appendTable(model);
    await batchUpdater(reqq, names);

    // console.log(JSON.stringify(ress, null, 2));
    // console.log(table);
  } catch (err) {
    console.error(err);
  }
  // const out = JSON.stringify(model);
  // console.log(out);

  // console.log(model.variables);
  // await delay();
}
async function batchUpdater(reqs, names) {
  const requests = [];
  // requests.push({
  //   'insertDimension': {
  //     'range': {
  //       'sheetId': 1451820191,
  //       'dimension': 'ROWS',
  //       'startIndex': 0,
  //     },
  //     'inheritFromBefore': false,
  //   }});
  requests.push(reqs);
  requests.push({
    'updateBorders': {
      'range': {
        'sheetId': 1451820191,
        'startColumnIndex': 0,
        'endColumnIndex': 10,
        'startRowIndex': 0,
        'endRowIndex': names.length,
      },
      'bottom': {
        'style': 'SOLID',
        'width': 1,
        'color': {'red': 0, 'green': 0, 'blue': 0, 'alpha': 1},
      },
      'innerHorizontal': {
        'style': 'SOLID',
      },
      'innerVertical': {
        'style': 'SOLID',
      },
    }});
  // requests.push({
  //   'repeatCell': {'range': {
  //     'sheetId': 1451820191,
  //     'startRowIndex': 0,
  //     'endRowIndex': 10,
  //     'startColumnIndex': 0,
  //     'endColumnIndex': 24},
  //   'cell': {
  //     'userEnteredFormat': {
  //       'horizontalAlignment': 'CENTER',
  //       'textFormat': {
  //         'bold': false,
  //       },
  //     },
  //   },
  //   'fields': 'userEnteredFormat.textFormat.bold',
  //   },
  // });
  const request = {
    spreadsheetId: spreadsheetId,
    resource: {
      requests: requests,
    },
  };
  try {
    const ress = (await sheets.spreadsheets.batchUpdate(request)).data;
    console.log(JSON.stringify(ress, null, 2));
    return ress;
  } catch (error) {
    console.log(error);
  }
}
async function getViews(out) {
  const values = [];
  let views = 0;
  let likes = 0;
  let dislikes = 0;
  let nps = 0;
  // console.log("Output" + output[0].snippet.title);
  const header = ['Title', 'Views', 'Likes', 'Dislikes', 'NPS'];
  for (let i = 0; i < out.length; i++) {
    views = views + parseInt(out[i].statistics.viewCount, 10);
    likes += parseInt(out[i].statistics.likeCount, 10);
    dislikes += parseInt(out[i].statistics.dislikeCount, 10);
    values.push([
      out[i].snippet.title,
      out[i].statistics.viewCount,
      out[i].statistics.likeCount,
      out[i].statistics.dislikeCount,
      (out[i].statistics.likeCount - out[i].statistics.dislikeCount) /
          out[i].statistics.viewCount,
    ]);
  }
  nps = (likes - dislikes) / views;
  // console.log('Index: ' + index);
  // let outt = JSON.stringify(model.variables[index]);
  // console.log('Variables: ' + outt);
  values.push(['Total', views, likes, dislikes, nps]);

  // console.log(values)

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    resource: {
      values: [],
    },
    requestBody: {
      values: [header, ...values],
    },
  });
  return [views, nps, likes, dislikes];
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 3000));
}

// eslint-disable-next-line no-unused-vars
async function getUploads(username) {
  try {
    const getUploadsId = await youtube.channels.list({
      part: 'snippet,contentDetails',
      forUsername: username,
    });
    const uploadsId = getUploadsId.data.items[0].id;

    console.log(uploadsId);
    return uploadsId;
  } catch (e) {
    console.error(e);
  }
}

async function setModel(viewIndex) {
  model.variables[viewIndex[0]]['views'] = viewIndex[1][0];
  model.variables[viewIndex[0]]['nps'] = viewIndex[1][1];
  model.variables[viewIndex[0]]['likes'] = viewIndex[1][2];
  model.variables[viewIndex[0]]['dislikes'] = viewIndex[1][3];
  if (viewIndex[2]-1 === viewIndex[0]) {
    // console.log(solver.Solve(model));
    return model;
  } else {
    console.log(viewIndex[1]);
  }
}

async function appendTable() {
  // , price, viewsPerCoin, viewPrice, nps, like, dislike, ctr
  const headers = [];
  // const values = [];
  const header = ['Name', 'Freq', 'Views', 'Price', 'Views per 1 UAH',
    'Price per 1 view',
    'NPS', 'Like', 'Dislike', 'CTR 0.4%', 'CTR 4%'];
  const solution = solver.Solve(model);
  const rows = [];
  // [name, freq, views]
  const variables = Object.entries(model)[3][1];

  for (let i = 0; i<header.length; i++) {
    headers.push({
      'userEnteredValue': {
        'stringValue': header[i],
      },
      'userEnteredFormat': {
        'textFormat': {
          'bold': true,
        },
      },
    });
  }
  rows.push({
    'values': headers,
  });
  // eslint-disable-next-line guard-for-in
  // for (item in variables) {
  //   // console.log(variables);

  //   values.push(
  //     nameCell,
  //     freqCell,
  //     viewsCell,
  //     priceCell, viewsPerUah, viewPrice, ctrSmall, ctrLarge);
  // }
  for (let i = 1; i <= Object.keys(variables).length; i++) {
    const freq = solution[i-1] || 0;
    const nameCell = {
      'userEnteredValue': {
        'stringValue': variables[i-1].names,
      },
      'userEnteredFormat': {
        'textFormat': {
          'bold': true,
        },
      },

    };
    const freqCell = {
      'userEnteredValue': {
        'numberValue': freq,
      },
    };
    const views = freq ? (solution.result/10) : 0;
    const viewsCell = {
      'userEnteredValue': {
        'numberValue': views,
      },
    };
    const price = variables[i-1].budget*freq;
    const priceCell = {
      'userEnteredValue': {
        'numberValue': price,
      },
    };
    const viewsPerUah = {
      'userEnteredValue': {
        'numberValue': freq ? (views/price) : 0,
      },
    };
    const viewPrice = {
      'userEnteredValue': {
        'numberValue': freq ? (price/views) : 0,
      },
    };
    const ctrSmall = {
      'userEnteredValue': {
        'numberValue': freq ? (views/freq*0.004) : 0,
      },
    };
    const ctrLarge = {
      'userEnteredValue': {
        'numberValue': freq ? (views/freq*0.04) : 0,
      },
    };

    // for (let j = 0; j < header.length; j++) {
    rows.push({
      'values': [nameCell,
        freqCell,
        viewsCell,
        priceCell,
        viewsPerUah, viewPrice, ctrSmall, ctrLarge],
    });
    // }
    // console.log(values);
  }


  rows.push({
    'values': [{
      'userEnteredValue': {
        'stringValue': 'Total',
      },
      'userEnteredFormat': {
        'textFormat': {
          'bold': true,
        },
      },
    },
    {
      'effectiveValue': {
        'formulaValue': '=SUM(B2:B'+Object.keys(variables).length+')',
      },
    }, {
      'effectiveValue': {
        'formulaValue': '=SUM(C2:C'+Object.keys(variables).length+')',
      },
    },
    {
      'effectiveValue': {
        'formulaValue': '=SUM(D2:D'+Object.keys(variables).length+')',
      },
    },
    ]});

  const request = {
    'appendCells': {
      'sheetId': 1451820191,
      'rows': rows,
      'fields': '*',
    },
  };
  try {
    // const response = await sheets.spreadsheets.values.append(request).data;
    console.log(request);
    return request;
  } catch (err) {
    console.error(err);
  }

  // return res;
}
initialize();


async function getVideos(id) {
  try {
    const videos = await youtube.search.list({
      part: 'snippet',
      channelId: id,
      maxResults: 10,
      order: 'date',
      type: 'video',
    });
    const videoID = [];

    videos.data.items.forEach(function(video) {
      videoID.push(video.id.videoId);
    });
    return videoID.join(',');
    // console.log(videoID.join(','));
  } catch (e) {
    console.error(e);
  }
}

async function getStats(ids) {
  try {
    const stats = await youtube.videos.list({
      part: ['snippet,contentDetails,statistics'],
      id: [ids],
    });
    const statistics = stats.data.items;
    return statistics;
  } catch (e) {
    console.error(e);
  }
}

// eslint-disable-next-line no-unused-vars

// model.variables = {
//   ['channel'+ ++i]
// }
