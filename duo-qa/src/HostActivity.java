package review.duo.widgetcheck;

import android.app.Activity;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Local UI test host. It interacts only through the public app-widget host API. */
public final class HostActivity extends Activity {
    private static final String GAME = "ru.mathclicker.duo";
    private static final String TAG = "DuoWidgetQA";
    private static final String[] NAMES = {"ProgressWidget", "ProgressWidget$City"};
    private static final String[] LABELS = {"Лаборатория", "Научный город"};
    private final AppWidgetHostView[] cards = new AppWidgetHostView[2];
    private final Handler handler = new Handler();
    private Resources gameResources;
    private AppWidgetHost host;
    private String token;
    private int polls;

    private void require(boolean ok, String message) {
        if (!ok) throw new IllegalStateException(message);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            gameResources = getPackageManager().getResourcesForApplication(GAME);
            host = new AppWidgetHost(this, 316);
            AppWidgetManager manager = AppWidgetManager.getInstance(this);
            SharedPreferences stored = getSharedPreferences("qa-host", MODE_PRIVATE);
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            setContentView(layout);
            for (int i = 0; i < NAMES.length; i++) {
                ComponentName name = new ComponentName(GAME, GAME + "." + NAMES[i]);
                AppWidgetProviderInfo provider = null;
                for (AppWidgetProviderInfo info : manager.getInstalledProviders()) {
                    if (name.equals(info.provider)) provider = info;
                }
                require(provider != null, "missing provider " + name);
                require(LABELS[i].equals(provider.loadLabel(getPackageManager())), "bad picker label " + name);
                require(provider.minWidth > provider.minHeight, "not wide: " + name);
                require(provider.loadPreviewImage(this, getResources().getDisplayMetrics().densityDpi) != null, "no preview " + name);
                int id = stored.getInt(NAMES[i], 0);
                if (id == 0) {
                    id = host.allocateAppWidgetId();
                    require(manager.bindAppWidgetIdIfAllowed(id, name), "bind denied " + name);
                    require(stored.edit().putInt(NAMES[i], id).commit(), "persist id");
                }
                require(name.equals(manager.getAppWidgetInfo(id).provider), "wrong restored binding " + id);
                cards[i] = host.createView(this, id, provider);
                layout.addView(cards[i], new LinearLayout.LayoutParams(dp(420), dp(114)));
                Log.i(TAG, "BIND " + LABELS[i] + " id=" + id + " dimensions=" + provider.minWidth + "x" + provider.minHeight);
            }
            probe(getIntent());
        } catch (Exception error) {
            Log.e(TAG, "FAIL create", error);
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onStart() {
        super.onStart();
        if (host != null) host.startListening();
    }

    @Override public void onStop() {
        if (host != null) host.stopListening();
        super.onStop();
    }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        probe(intent);
    }

    private void probe(Intent intent) {
        handler.removeCallbacksAndMessages(null);
        token = intent.getStringExtra("phase");
        if (token == null) token = "rotated";
        polls = 0;
        handler.postDelayed(this::inspect, 150);
    }

    private int id(String name) { return gameResources.getIdentifier(name, "id", GAME); }

    private void inspect() {
        try {
            StringBuilder ids = new StringBuilder();
            StringBuilder coordinates = new StringBuilder();
            StringBuilder values = new StringBuilder();
            for (int i = 0; i < cards.length; i++) {
                AppWidgetHostView widget = cards[i];
                TextView title = widget.findViewById(id("widget_title"));
                TextView value = widget.findViewById(id("widget_value"));
                TextView detail = widget.findViewById(id("widget_detail"));
                View target = widget.findViewById(id("widget_card"));
                if (title == null || !LABELS[i].contentEquals(title.getText()) || target == null ||
                        !target.hasOnClickListeners() || target.getWidth() == 0 || value == null || detail == null ||
                        "Открыть игру".contentEquals(value.getText())) {
                    if (++polls >= 80) throw new IllegalStateException("No live remote views for " + LABELS[i] +
                            "; title=" + (title == null ? "missing" : title.getText()) +
                            " value=" + (value == null ? "missing" : value.getText()));
                    handler.postDelayed(this::inspect, 250);
                    return;
                }
                int[] xy = new int[2];
                target.getLocationOnScreen(xy);
                if (i > 0) { ids.append(","); coordinates.append(","); values.append(" | "); }
                ids.append(widget.getAppWidgetId());
                coordinates.append(xy[0] + target.getWidth() / 2).append(":").append(xy[1] + target.getHeight() / 2);
                values.append(title.getText()).append(" ").append(value.getText()).append(" ").append(detail.getText());
            }
            Log.i(TAG, "READY " + token + " ids=" + ids + " targets=" + coordinates + " content=" + values);
        } catch (Exception e) {
            Log.e(TAG, "FAIL " + token, e);
        }
    }
}
