importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide!");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded!");
  await self.pyodide.loadPackage("micropip");
  const env_spec = ['https://cdn.holoviz.org/panel/0.14.2/dist/wheels/bokeh-2.4.3-py3-none-any.whl', 'https://cdn.holoviz.org/panel/0.14.2/dist/wheels/panel-0.14.2-py3-none-any.whl', 'pyodide-http==0.1.0', 'altair', 'numpy', 'pandas', 'pyecharts', 'wordcloud']
  for (const pkg of env_spec) {
    let pkg_name;
    if (pkg.endsWith('.whl')) {
      pkg_name = pkg.split('/').slice(-1)[0].split('-')[0]
    } else {
      pkg_name = pkg
    }
    self.postMessage({type: 'status', msg: `Installing ${pkg_name}`})
    try {
      await self.pyodide.runPythonAsync(`
        import micropip
        await micropip.install('${pkg}');
      `);
    } catch(e) {
      console.log(e)
      self.postMessage({
	type: 'status',
	msg: `Error while installing ${pkg_name}`
      });
    }
  }
  console.log("Packages loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  const code = `
  
import asyncio

from panel.io.pyodide import init_doc, write_doc

init_doc()

import pandas as pd
import altair as alt
import panel as pn
from pyecharts import options as opts
from pyecharts.charts import WordCloud, Tab
from pyecharts.globals import SymbolType
import numpy as np
pn.extension("echarts")

# Filter and aggregate data
df = pd.read_excel('dataset final.xlsx')
data = []
for genre in ['Classical', 'Country', 'EDM', 'Folk', 'Gospel', 'Hip hop', 'Jazz', 'K pop', 'Latin', 'Lofi', 'Metal','Pop', 'R&B', 'Rap', 'Rock', 'Video game music']:
    count = 0
    for issue in ['Anxiety', 'Depression', 'Insomnia', 'OCD']:
        filtered_df = df[df['Fav genre'] == genre]
        avg_issue = filtered_df[issue].mean()
        avg_frequency = filtered_df['Hours per day'].mean()
        data.append({'Fav genre': genre, 'Mental issue': issue, 'Average issue': avg_issue, 'Average frequency': avg_frequency})
        count += 1
agg_df = pd.DataFrame(data)

# Create an interval selection
selection = alt.selection_multi(fields=['Fav genre'])

# Create the bubble chart
bchart = alt.Chart(agg_df).mark_circle().encode(
    x=alt.X('Mental issue:N', axis=alt.Axis(title='Mental Issue')),
    y=alt.Y('Fav genre:N', axis=alt.Axis(title='Favorite Genre')),
    size=alt.Size('Average issue:Q', scale=alt.Scale(range=[0, 1000]), legend=alt.Legend(title='Intensity of Mental Health')),
    color=alt.Color('Average frequency:Q', scale=alt.Scale(scheme='viridis', domain=[0, 10]), legend=alt.Legend(title='Frequency of Listening')),
    tooltip=['Fav genre:N', 'Mental issue:N', 'Average issue:Q', 'Average frequency:Q'],
    opacity=alt.condition(selection, alt.value(1), alt.value(0.1))  # Apply the selection interaction by adjusting the opacity

).properties(
    width=300,  # Set the width of the chart in pixels
    height=500  # Set the height of the chart in pixels
).add_selection(
    selection  # Add the selection interaction to the chart
).interactive()

#other graphs
df = pd.read_excel('dataset final.xlsx')
df['mental_state'] = df['Anxiety'] + df['Depression'] + df['Insomnia'] + df['OCD']

def base_interact():
    interval = alt.selection_interval()
    # click = alt.selection_single(fields = ['Music effects'])

    base_color_scale = alt.Scale(domain = [0, 16, 30, 40], range = ['green', 'yellow', 'red', 'black'])
    base_chart = alt.Chart(df).mark_circle(size = 50).encode(
        x = alt.X('Age:Q', scale = alt.Scale(domain = (5, 90))),
        y = alt.Y('Hours per day:Q', scale = alt.Scale(domain = (0, 25))),
        # color = alt.Color('mental_state:Q', scale = base_color_scale),
        color = alt.condition(interval, 'mental_state:Q', alt.value('lightgray'), scale = base_color_scale, legend = None),
        tooltip = ['Age:Q', 'Hours per day:Q', 'mental_state:Q']
    ).add_selection(interval).properties(
        width = 520,
        height = 450,
        title = 'Age & Hours vs. Mental State'
    )

    effect_color_scale = alt.Scale(domain = ['No effect', 'Improve', 'Worsen'], range = ['khaki', 'lightgreen', 'tomato'])
    effect_chart = alt.Chart(df).mark_bar().encode(
        y = alt.Y('count():Q', title = None),
        x = alt.X('Music effects:N', title = None),
        color = alt.Color('Music effects:N', scale = effect_color_scale, legend = None),
        # color = alt.condition(click, 'Music effects:N', alt.value('lightgray'), scale = effect_color_scale),
        tooltip = ['Music effects:N']
    ).transform_filter(interval).properties(
        width = 150,
        height = 150,
        title = 'Music Effects'
    )

    working_color_scale = alt.Scale(domain = ['No', 'Yes'], range = ['blue', 'red'])
    working_chart = alt.Chart(df).mark_arc().encode(
        theta = 'count():Q',
        color = alt.Color('While working:N', scale = working_color_scale, legend = None),
        # color = alt.condition(click, 'While working:N', alt.value('lightgray'), scale = working_color_scale),
        tooltip = ['While working:N']
    ).transform_filter(interval).properties(
        width = 150,
        height = 150,
        title = 'While Working'
    )

    platform_chart = alt.Chart(df).mark_bar().encode(
        x = 'count():Q',
        y = alt.Y('Primary streaming service:N', title = None),
        tooltip = ['Primary streaming service:N']
    ).transform_filter(interval).properties(
        width = 150,
        height = 150,
        title = 'Music Platform'
    )

    genre_chart = alt.Chart(df).mark_boxplot(extent = 'min-max').encode(
        x = 'Hours per day:Q',
        y = alt.Y('Fav genre:N', title = None),
        tooltip = ['Fav genre:N']
    ).transform_filter(interval).properties(
        width = 150,
        height = 670,
    )

    bottom_charts = platform_chart | effect_chart | working_chart
    left_charts = base_chart & bottom_charts
    combined = left_charts | genre_chart
    return combined

def platform_interact():
    # interval = alt.selection_interval()
    click = alt.selection_single(fields = ['Primary streaming service'])

    base_color_scale = alt.Scale(domain = [0, 16, 30, 40], range = ['green', 'yellow', 'red', 'black'])
    base_chart = alt.Chart(df).mark_circle(size = 50).encode(
        x = alt.X('Age:Q', scale = alt.Scale(domain = (5, 90))),
        y = alt.Y('Hours per day:Q', scale = alt.Scale(domain = (0, 25))),
        color = alt.Color('mental_state:Q', scale = base_color_scale, legend = None),
        # color = alt.condition(click, 'mental_state:Q', alt.value('lightgray'), scale = base_color_scale, legend = None),
        tooltip = ['Age:Q', 'Hours per day:Q', 'mental_state:Q']
    ).transform_filter(click).properties(
        width = 520,
        height = 450,
        title = 'Age & Hours vs. Mental State'
    )

    effect_color_scale = alt.Scale(domain = ['No effect', 'Improve', 'Worsen'], range = ['khaki', 'lightgreen', 'tomato'])
    effect_chart = alt.Chart(df).mark_bar().encode(
        y = alt.Y('count():Q', title = None),
        x = alt.X('Music effects:N', title = None),
        color = alt.Color('Music effects:N', scale = effect_color_scale, legend = None),
        # color = alt.condition(click, 'Music effects:N', alt.value('lightgray'), scale = effect_color_scale),
        tooltip = ['Music effects:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'Music Effects'
    )

    working_color_scale = alt.Scale(domain = ['No', 'Yes'], range = ['blue', 'red'])
    working_chart = alt.Chart(df).mark_arc().encode(
        theta = 'count():Q',
        color = alt.Color('While working:N', scale = working_color_scale, legend = None),
        # color = alt.condition(click, 'While working:N', alt.value('lightgray'), scale = working_color_scale),
        tooltip = ['While working:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'While Working'
    )

    platform_chart = alt.Chart(df).mark_bar().encode(
        x = 'count():Q',
        y = alt.Y('Primary streaming service:N', title = None),
        tooltip = ['Primary streaming service:N']
    ).add_selection(click).properties(
        width = 150,
        height = 150,
        title = 'Music Platform'
    )

    genre_chart = alt.Chart(df).mark_boxplot(extent = 'min-max').encode(
        x = 'Hours per day:Q',
        y = alt.Y('Fav genre:N', title = None),
        tooltip = ['Fav genre:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 670,
    )

    bottom_charts = platform_chart | effect_chart | working_chart
    left_charts = base_chart & bottom_charts
    combined = left_charts | genre_chart
    return combined

def effect_interact():
    # interval = alt.selection_interval()
    click = alt.selection_single(fields = ['Music effects'])

    base_color_scale = alt.Scale(domain = [0, 16, 30, 40], range = ['green', 'yellow', 'red', 'black'])
    base_chart = alt.Chart(df).mark_circle(size = 50).encode(
        x = alt.X('Age:Q', scale = alt.Scale(domain = (5, 90))),
        y = alt.Y('Hours per day:Q', scale = alt.Scale(domain = (0, 25))),
        color = alt.Color('mental_state:Q', scale = base_color_scale, legend = None),
        # color = alt.condition(click, 'mental_state:Q', alt.value('lightgray'), scale = base_color_scale, legend = None),
        tooltip = ['Age:Q', 'Hours per day:Q', 'mental_state:Q']
    ).transform_filter(click).properties(
        width = 520,
        height = 450,
        title = 'Age & Hours vs. Mental State'
    )

    effect_color_scale = alt.Scale(domain = ['No effect', 'Improve', 'Worsen'], range = ['khaki', 'lightgreen', 'tomato'])
    effect_chart = alt.Chart(df).mark_bar().encode(
        y = alt.Y('count():Q', title = None),
        x = alt.X('Music effects:N', title = None),
        # color = alt.Color('Music effects:N', scale = effect_color_scale, legend = None),
        color = alt.condition(click, 'Music effects:N', alt.value('lightgray'), scale = effect_color_scale, legend = None),
        tooltip = ['Music effects:N']
    ).add_selection(click).properties(
        width = 150,
        height = 150,
        title = 'Music Effects'
    )

    working_color_scale = alt.Scale(domain = ['No', 'Yes'], range = ['blue', 'red'])
    working_chart = alt.Chart(df).mark_arc().encode(
        theta = 'count():Q',
        color = alt.Color('While working:N', scale = working_color_scale, legend = None),
        # color = alt.condition(click, 'While working:N', alt.value('lightgray'), scale = working_color_scale),
        tooltip = ['While working:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'While Working'
    )

    platform_chart = alt.Chart(df).mark_bar().encode(
        x = 'count():Q',
        y = alt.Y('Primary streaming service:N', title = None),
        tooltip = ['Primary streaming service:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'Music Platform'
    )

    genre_chart = alt.Chart(df).mark_boxplot(extent = 'min-max').encode(
        x = 'Hours per day:Q',
        y = alt.Y('Fav genre:N', title = None),
        tooltip = ['Fav genre:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 670,
    )

    bottom_charts = platform_chart | effect_chart | working_chart
    left_charts = base_chart & bottom_charts
    combined = left_charts | genre_chart
    return combined

def working_interact():
    # interval = alt.selection_interval()
    click = alt.selection_single(fields = ['While working'])

    base_color_scale = alt.Scale(domain = [0, 16, 30, 40], range = ['green', 'yellow', 'red', 'black'])
    base_chart = alt.Chart(df).mark_circle(size = 50).encode(
        x = alt.X('Age:Q', scale = alt.Scale(domain = (5, 90))),
        y = alt.Y('Hours per day:Q', scale = alt.Scale(domain = (0, 25))),
        color = alt.Color('mental_state:Q', scale = base_color_scale, legend = None),
        # color = alt.condition(click, 'mental_state:Q', alt.value('lightgray'), scale = base_color_scale, legend = None),
        tooltip = ['Age:Q', 'Hours per day:Q', 'mental_state:Q']
    ).transform_filter(click).properties(
        width = 520,
        height = 450,
        title = 'Age & Hours vs. Mental State'
    )

    effect_color_scale = alt.Scale(domain = ['No effect', 'Improve', 'Worsen'], range = ['khaki', 'lightgreen', 'tomato'])
    effect_chart = alt.Chart(df).mark_bar().encode(
        y = alt.Y('count():Q', title = None),
        x = alt.X('Music effects:N', title = None),
        color = alt.Color('Music effects:N', scale = effect_color_scale, legend = None),
        # color = alt.condition(click, 'Music effects:N', alt.value('lightgray'), scale = effect_color_scale, legend = None),
        tooltip = ['Music effects:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'Music Effects'
    )

    working_color_scale = alt.Scale(domain = ['No', 'Yes'], range = ['blue', 'red'])
    working_chart = alt.Chart(df).mark_arc().encode(
        theta = 'count():Q',
        # color = alt.Color('While working:N', scale = working_color_scale, legend = None),
        color = alt.condition(click, 'While working:N', alt.value('lightgray'), scale = working_color_scale, legend = None),
        tooltip = ['While working:N']
    ).add_selection(click).properties(
        width = 150,
        height = 150,
        title = 'While Working'
    )

    platform_chart = alt.Chart(df).mark_bar().encode(
        x = 'count():Q',
        y = alt.Y('Primary streaming service:N', title = None),
        tooltip = ['Primary streaming service:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 150,
        title = 'Music Platform'
    )

    genre_chart = alt.Chart(df).mark_boxplot(extent = 'min-max').encode(
        x = 'Hours per day:Q',
        y = alt.Y('Fav genre:N', title = None),
        tooltip = ['Fav genre:N']
    ).transform_filter(click).properties(
        width = 150,
        height = 670,
    )

    bottom_charts = platform_chart | effect_chart | working_chart
    left_charts = base_chart & bottom_charts
    combined = left_charts | genre_chart
    return combined

options = ['Scatter Plot', 'Music Platforms', 'Music Effects', 'While Working']
select = pn.widgets.Select(name = 'Select the chart you want to interact with:',
                           options = options)

@pn.depends(select.param.value)
def display_chart(chart):
    if chart == 'Scatter Plot':
        return pn.Column(base_interact())
    elif chart == 'Music Platforms':
        return pn.Column(platform_interact())
    elif chart == 'Music Effects':
        return pn.Column(effect_interact())
    elif chart == 'While Working':
        return pn.Column(working_interact())

from bokeh.plotting import figure, show
from bokeh.models import ColumnDataSource, HoverTool
from wordcloud import WordCloud
text = 'TEST'

wordcloud = WordCloud(width=800, height=600, background_color='white').generate(text)

data = {
    'x': [100],
    'y': [100],
    'word': ["test"],
    'size': [100]
}
# wordcloud.layout_
# for word, size, (x, y),, in wordcloud.layout_:
#     data['x'].append(x)
#     data['y'].append(y)
#     data['word'].append(word)
#     data['size'].append(size)

source = ColumnDataSource(data)

p = figure(x_range=(0, 800), y_range=(0, 600), plot_width=600, plot_height=600)

p.text(x='x', y='y', text='word', text_font_size='size', source=source)

hover = HoverTool(tooltips=[('Word', '@word'), ('Size', '@size')])
p.add_tools(hover)

bokeh_pane = pn.pane.Bokeh(p)

#bokeh_pane.servable()

"""app = pn.Row(
    pn.Column("Bubble chart", bchart),
    pn.Column(bokeh_pane),
    pn.Column(select, display_chart)
)"""

app = pn.Column(
    pn.Row(
        pn.Column("Bubble chart", bchart),
        pn.Column("wordcloud",bokeh_pane)
    ),
    pn.Row(
        pn.Column(select, display_chart)
    )
)
# Run the app
app.servable()


await write_doc()
  `

  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(code)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.runPythonAsync(`
    import json

    state.curdoc.apply_json_patch(json.loads('${msg.patch}'), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads("""${msg.location}""")
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()