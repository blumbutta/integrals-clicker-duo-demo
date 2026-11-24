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
import android.graphics.Bitmap;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Hosts the production provider solely through Android's public home-screen widget API. */
public final class HostActivity extends Activity {
    private static final String GAME = "ru.mathclicker.duo";
    private static final String TAG = "DuoWidgetQA";
    private final Handler handler = new Handler();
    private Resources gameResources;
    private AppWidgetHost host;
    private AppWidgetHostView widget;
    private String phase;
    private int attempts;

    private void require(boolean ok, String message) {
        if (!ok) throw new IllegalStateException(message);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            gameResources = getPackageManager().getResourcesForApplication(GAME);
            host = new AppWidgetHost(this, 316);
            AppWidgetManager manager = AppWidgetManager.getInstance(this);
            ComponentName name = new ComponentName(GAME, GAME + ".ProgressWidget");
            AppWidgetProviderInfo provider = null;
            int count = 0;
            for (AppWidgetProviderInfo info : manager.getInstalledProviders()) {
                if (GAME.equals(info.provider.getPackageName())) {
                    count++;
                    if (name.equals(info.provider)) provider = info;
                }
            }
            require(count == 1 && provider != null, "Expected only the lab, saw " + count + " providers");
            require("Баланс интегралов".equals(provider.loadLabel(getPackageManager())), "Unexpected picker label " + provider.loadLabel(getPackageManager()));
            require(provider.minWidth > provider.minHeight, "Provider is not wide");
            require(provider.loadPreviewImage(this, getResources().getDisplayMetrics().densityDpi) != null, "Missing picker preview");
            SharedPreferences saved = getSharedPreferences("qa-host", MODE_PRIVATE);
            int id = saved.getInt("id", 0);
            if (id == 0) {
                id = host.allocateAppWidgetId();
                require(manager.bindAppWidgetIdIfAllowed(id, name), "Android refused to bind");
                require(saved.edit().putInt("id", id).commit(), "Persist widget ID");
            }
            require(name.equals(manager.getAppWidgetInfo(id).provider), "Wrong restored binding " + id);
            widget = host.createView(this, id, provider);
            LinearLayout parent = new LinearLayout(this);
            parent.addView(widget, new LinearLayout.LayoutParams(dp(420), dp(125)));
            setContentView(parent);
            Log.i(TAG, "ONE_PROVIDER " + provider.loadLabel(getPackageManager()) + " id=" + id + " wide=" + provider.minWidth + "x" + provider.minHeight);
            inspectLater(getIntent());
        } catch (Exception error) {
            Log.e(TAG, "FAIL create", error);
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private int id(String name) { return gameResources.getIdentifier(name, "id", GAME); }
    @Override public void onStart() { super.onStart(); if (host != null) host.startListening(); }
    @Override public void onStop() { if (host != null) host.stopListening(); super.onStop(); }
    @Override public void onDestroy() { handler.removeCallbacksAndMessages(null); super.onDestroy(); }

    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        inspectLater(intent);
    }

    private void inspectLater(Intent intent) {
        handler.removeCallbacksAndMessages(null);
        phase = intent.getStringExtra("phase");
        if (phase == null) phase = "rotated";
        attempts = 0;
        handler.postDelayed(this::inspect, 180);
    }

    private int visibleLabels(View v) {
        if (v.getVisibility() != View.VISIBLE) return 0;
        if (v instanceof TextView) return ((TextView) v).getText().length() == 0 ? 0 : 1;
        if (!(v instanceof ViewGroup)) return 0;
        ViewGroup group = (ViewGroup) v;
        int count = 0;
        for (int i = 0; i < group.getChildCount(); i++) count += visibleLabels(group.getChildAt(i));
        return count;
    }

    private Bitmap bitmap(String name) {
        ImageView image = widget.findViewById(id(name));
        Drawable drawable = image == null ? null : image.getDrawable();
        if (!(drawable instanceof BitmapDrawable)) return null;
        return ((BitmapDrawable) drawable).getBitmap();
    }

    private String fingerprint(Bitmap bitmap) {
        Bitmap software = bitmap.getConfig() == Bitmap.Config.HARDWARE ? bitmap.copy(Bitmap.Config.ARGB_8888, false) : bitmap;
        long hash = 1;
        for (int y=0; y<7; y++) {
            for (int x=0; x<13; x++) hash = hash * 31 + software.getPixel((x * 2+1)*software.getWidth()/26,(y*2+1)*software.getHeight()/14);
        }
        return software.getWidth() + "x" + software.getHeight() + "-" + Long.toHexString(hash);
    }

    private void inspect() {
        try {
            View target = widget.findViewById(id("widget_card"));
            TextView value = widget.findViewById(id("widget_value"));
            Bitmap bg = bitmap("widget_background"), art = bitmap("widget_art");
            String text = value == null ? "" : value.getText().toString().trim();
            boolean ready = target != null && target.hasOnClickListeners() && target.getWidth() > 0 && text.endsWith("∫")
                    && bg != null && art != null && bg.getWidth() == 640 && bg.getHeight() == 240 && art.getWidth() == 160 && art.getHeight() == 160;
            if (!ready) {
                if (++attempts >= 120) throw new IllegalStateException("No complete snapshot: balance=" + text
                        + " bg=" + (bg == null ? "null" : bg.getWidth()+"x"+bg.getHeight())
                        + " art=" + (art == null ? "null" : art.getWidth()+"x"+art.getHeight())
                        + " clickable=" + (target != null && target.hasOnClickListeners()));
                handler.postDelayed(this::inspect, 250);
                return;
            }
            require(visibleLabels(target) == 1, "Unexpected visible text besides the balance");
            int[] xy = new int[2];
            target.getLocationOnScreen(xy);
            Log.i(TAG, "READY " + phase + " ids=" + widget.getAppWidgetId() + " targets=" + (xy[0]+target.getWidth()/2)
                    + ":" + (xy[1]+target.getHeight()/2) + " skin=" + fingerprint(bg) + "/" + fingerprint(art) + " balance=" + text);
        } catch (Exception e) {
            Log.e(TAG, "FAIL " + phase, e);
        }
    }
}
