const { google } = require("googleapis");
const youtube = google.youtube({
  version: "v3",
  auth: "", // specify your API key here
});
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");

const sheets = google.sheets("v4");
const spreadsheetId = "";
const range = "Лист2";
const input = "Лист3!B1:C1";

async function ruS(spreadsheetId, range, output) {
  let values = [];
  let views = 0,
    likes = 0,
    dislikes = 0,
    nps = 0;
  // console.log("Output" + output[0].snippet.title);
  const header = ["Title", "Views", "Likes", "Dislikes", "NPS"];
  for (var i = 0; i < output.length + 1; i++) {
    if (i < output.length) {
      views += parseInt(output[i].statistics.viewCount, 10);
      likes += parseInt(output[i].statistics.likeCount, 10);
      dislikes += parseInt(output[i].statistics.dislikeCount, 10);
      values.push([
        output[i].snippet.title,
        output[i].statistics.viewCount,
        output[i].statistics.likeCount,
        output[i].statistics.dislikeCount,
        (output[i].statistics.likeCount - output[i].statistics.dislikeCount) /
          output[i].statistics.viewCount,
      ]);
    } else {
      nps = (likes - dislikes) / views;
      values.push(["Total", views, likes, dislikes, nps]);
    }
  }

  // console.log(values)

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    resource: {
      values: [],
    },
    requestBody: {
      values: [header, ...values],
    },
  });
  return res.data;
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 5000));
}

async function runSample(item) {
  try {
    const getUploadsId = await youtube.channels.list({
      part: "snippet,contentDetails",
      forUsername: item,
    });
    const uploadsId = getUploadsId.data.items[0].id;

    await delay();
    getVideos(uploadsId);

    console.log(uploadsId);
  } catch (e) {
    console.error(e);
  }
}

async function initialize() {
  const auth = await authenticate({
    keyfilePath: path.join(__dirname, "./oauth2.keys.json"),
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
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
    const names = response.values[0];

    console.log(names);
    for (const item of names) {
      await runSample(item);
    }
  } catch (err) {
    console.error(err);
  }
  // await delay();
}

initialize();

async function getVideos(id) {
  try {
    const videos = await youtube.search.list({
      part: "snippet",
      channelId: id,
      maxResults: 10,
      order: "date",
      type: "video",
    });
    const videoID = [];

    videos.data.items.forEach(function (video) {
      videoID.push(video.id.videoId);
    });

    // console.log(videoID.join(','));
    getStats(videoID.join(","));
  } catch (e) {
    console.error(e);
  }
}

async function getStats(ids) {
  try {
    const stats = await youtube.videos.list({
      part: ["snippet,contentDetails,statistics"],
      id: [ids],
    });
    const statistics = [];
    // console.log(stats.data.items)

    stats.data.items.forEach(function (stat) {
      statistics.push(stat);
    });
    ruS(spreadsheetId, range, statistics);
  } catch (e) {
    console.error(e);
  }
}

var solver = require("javascript-lp-solver"),
  model = {
    optimize: "views",
    opType: "max",
    constraints: {
      budget: {
        max: 75000,
      },
    },
    variables: {
      fr1: {
        budget: 18500,
        views: 41200,
        fr1: 1,
      },
      fr2: {
        budget: 6500,
        views: 251800,
        fr2: 1,
      },
      fr3: {
        budget: 3800,
        views: 16300,
        fr3: 1,
      },
      fr4: {
        budget: 9500,
        views: 325700,
        fr4: 1,
      },
      fr5: {
        budget: 11400,
        views: 205000,
        fr5: 1,
      },
    },
    ints: {
      fr1: 1,
      fr2: 1,
      fr3: 1,
      fr4: 1,
      fr5: 1,
    },
  };

console.log(solver.Solve(model));
