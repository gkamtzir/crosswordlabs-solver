const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

(async () => {
  const url = getUrl();
  if (url == null) {
    return;
  }

  // Initialization.
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Setting up the browser configuration.
  await page.setViewport({
    width: 1280,
    height: 768,
    deviceScaleFactor: 1,
  });

  await page.goto(url);

  // Loading page content.
  let content = await page.content();
  const grid = JSON.parse(content.match(/(?<=var grid =)(.*)(?=;)/)[0]);

  // Preparing the solution data so we can
  // effectively below.
  const { data, ids } = prepareSolutionData(grid);

  // Using 'cheerio' for easier DOM access.
  let $ = cheerio.load(content);

  const crossword = $("#crossword").children();
  for (const child of crossword[0].children) {
    // We care only for the 'g' nodes with 3 children, since
    // words start only from those boxes.
    if (child.children != null && child.children.length === 3) {
      const orientation = ids[child.attribs.id];

      if (orientation["down"] != null) {
        // Highligting the current word.
        await highlightWord(page, child.attribs.id, "down");

        // Inserting the word.
        await page.keyboard.type(data[orientation["down"]].join(""), {
          delay: 0,
        });
      }

      if (orientation["across"] != null) {
        // Highligting the current word.
        await highlightWord(page, child.attribs.id, "across");

        // Inserting the word.
        await page.keyboard.type(data[orientation["across"]].join(""), {
          delay: 0,
        });
      }
    }
  }
})();

/**
 * Construct the exact url by passing the crossword id.
 */
function getUrl() {
  const crosswordUrl = 'https://crosswordlabs.com/view/';
  if (process.argv.length === 3) {
    return crosswordUrl + process.argv[2];
  } else {
    console.error('Please make sure to pass only the id of the crossword');
    return null;
  }
}

/**
 * Highlights the word that starts from the box with the
 * given id.
 * @param {Object} page The currently loaded web page.
 * @param {string} id The id of the first box of a word.
 * @param {string} orientation The orientation of the word.
 */
async function highlightWord(page, id, orientation) {
  // Clicking at the first box of the current word.
  await page.click(`#${id}`, { button: "left", delay: 0 });

  // Storing the coordinates of the current box.
  const coords = id.slice(3).split("-");

  // Reloading page content to check for
  // changes
  const content = await page.content();
  $ = cheerio.load(content);

  // Referencing the next box for the current word
  // depending on the orientation of the word.
  const next =
    orientation === "down"
      ? $(`#cx-${parseInt(coords[0]) + 1}-${coords[1]}`)
      : $(`#cx-${coords[0]}-${parseInt(coords[1]) + 1}`);

  // If the next box is not hightlighted, then we
  // make sure to hightlight it.
  if (!next.hasClass("highlighted")) {
    await page.click(`#${id}`, {
      button: "left",
      delay: 0,
    });
  }
}

/**
 * Prepares the data in a more readable format and
 * maps them to the corresponding 'entry' box.
 * @param {Object[]} grid The 'grid' variable from
 * the crosswordlabs site.
 */
function prepareSolutionData(grid) {
  const data = {};
  const ids = {};

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = grid[i][j];
      if (cell != null) {
        if (cell["down"] != null) {
          mapData(data, ids, `cx-${i}-${j}`, cell, 'down');
        }

        if (cell["across"] != null) {
          mapData(data, ids, `cx-${i}-${j}`, cell, 'across');
        }
      }
    }
  }

  return { data, ids };
}

/**
 * Maps the letters to the corresponding ids.
 * @param {Object} data The current state of the words. 
 * @param {Object} ids The current state of words' ids.
 * @param {string} id The id of the first box of a word (or two words).
 * @param {Object} cell The current grid cell.
 * @param {string} orientation The orientation of the word that starts
 * at the given id.
 */
function mapData(data, ids, id, cell, orientation) {
  const character = cell["char"];
  const index = cell[orientation]["index"];

  if (index != null) {
    if (data[index] != null) {
      data[index].push(character);
    } else {
      if (!(ids[id] != null)) {
        ids[id] = {
          down: null,
          across: null,
        };
      }

      ids[id][orientation] = index;
      data[index] = [character];
    }
  }
}
