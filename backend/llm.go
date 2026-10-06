package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// LLM membungkus Claude API. API key hanya ada di backend (env ANTHROPIC_API_KEY),
// tidak pernah dikirim ke frontend.
type LLM struct {
	client    anthropic.Client
	model     string
	effort    string
	fallbacks bool
}

func NewLLM(apiKey, model, effort string, fallbacks bool) *LLM {
	return &LLM{
		client:    anthropic.NewClient(option.WithAPIKey(apiKey)),
		model:     model,
		effort:    effort,
		fallbacks: fallbacks,
	}
}

func (l *LLM) requestOptions(extra ...option.RequestOption) []option.RequestOption {
	opts := []option.RequestOption{option.WithJSONSet("output_config.effort", l.effort)}
	if l.fallbacks {
		// Jika permintaan ditolak oleh safety classifier, server otomatis mengulang
		// dengan model cadangan yang sesuai (server-side fallback).
		opts = append(opts,
			option.WithHeaderAdd("anthropic-beta", "server-side-fallback-2026-07-01"),
			option.WithJSONSet("fallbacks", "default"),
		)
	}
	return append(opts, extra...)
}

// ConsultFunc dipanggil ketika agen memakai tool tanya_agen.
type ConsultFunc func(ctx context.Context, toAgent, question string) (string, error)

func consultTool(self string, reg *Registry) anthropic.ToolUnionParam {
	var ids []string
	var desc []string
	for _, a := range reg.List {
		if a.ID != self && a.ID != "ceo" {
			ids = append(ids, a.ID)
			desc = append(desc, fmt.Sprintf("%s (%s)", a.ID, a.Role))
		}
	}
	t := anthropic.ToolParam{
		Name: "tanya_agen",
		Description: anthropic.String("Bertanya ke agen lain di tim Gustee Bakery untuk data di luar bidangmu. " +
			"Agen yang bisa ditanya: " + strings.Join(desc, ", ") + ". Jawaban akan dikembalikan sebagai hasil tool."),
		InputSchema: anthropic.ToolInputSchemaParam{
			Properties: map[string]any{
				"agen":       map[string]any{"type": "string", "enum": ids, "description": "id agen yang ditanya"},
				"pertanyaan": map[string]any{"type": "string", "description": "pertanyaan singkat dan spesifik"},
			},
			Required: []string{"agen", "pertanyaan"},
		},
	}
	return anthropic.ToolUnionParam{OfTool: &t}
}

// Run menjalankan satu agen dengan streaming. onDelta menerima potongan teks agar
// bubble chat muncul bertahap. Bila consult != nil, agen boleh memakai tool tanya_agen.
// Mengembalikan teks dari giliran terakhir (hasil kerja final).
func (l *LLM) Run(ctx context.Context, system, user string, tools []anthropic.ToolUnionParam,
	onDelta func(string), consult ConsultFunc) (string, error) {

	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(l.model),
		MaxTokens: 64000,
		System: []anthropic.TextBlockParam{{
			Text:         system,
			CacheControl: anthropic.NewCacheControlEphemeralParam(),
		}},
		Messages: []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(user))},
	}
	if consult != nil && len(tools) > 0 {
		params.Tools = tools
	}

	var final string
	for turn := 0; turn < 5; turn++ {
		stream := l.client.Messages.NewStreaming(ctx, params, l.requestOptions()...)
		msg := anthropic.Message{}
		var turnText strings.Builder
		for stream.Next() {
			ev := stream.Current()
			if err := msg.Accumulate(ev); err != nil {
				return "", err
			}
			if e, ok := ev.AsAny().(anthropic.ContentBlockDeltaEvent); ok {
				if d, ok := e.Delta.AsAny().(anthropic.TextDelta); ok {
					turnText.WriteString(d.Text)
					onDelta(d.Text)
				}
			}
		}
		if err := stream.Err(); err != nil {
			return "", describeErr(err)
		}
		if msg.StopReason == anthropic.StopReasonRefusal {
			return "", errors.New("permintaan ditolak oleh model (refusal)")
		}
		final = turnText.String()
		params.Messages = append(params.Messages, msg.ToParam())
		if msg.StopReason != anthropic.StopReasonToolUse {
			break
		}

		var results []anthropic.ContentBlockParamUnion
		for _, block := range msg.Content {
			tu, ok := block.AsAny().(anthropic.ToolUseBlock)
			if !ok {
				continue
			}
			var in struct {
				Agen       string `json:"agen"`
				Pertanyaan string `json:"pertanyaan"`
			}
			if err := json.Unmarshal([]byte(tu.JSON.Input.Raw()), &in); err != nil || in.Agen == "" || in.Pertanyaan == "" {
				results = append(results, anthropic.NewToolResultBlock(tu.ID, "Input tool tidak valid: butuh 'agen' dan 'pertanyaan'.", true))
				continue
			}
			if turn >= 3 {
				results = append(results, anthropic.NewToolResultBlock(tu.ID, "Batas pertanyaan tercapai. Selesaikan tugas dengan data yang ada.", true))
				continue
			}
			answer, err := consult(ctx, in.Agen, in.Pertanyaan)
			if err != nil {
				results = append(results, anthropic.NewToolResultBlock(tu.ID, "Gagal bertanya: "+err.Error(), true))
				continue
			}
			results = append(results, anthropic.NewToolResultBlock(tu.ID, answer, false))
		}
		params.Messages = append(params.Messages, anthropic.NewUserMessage(results...))
		onDelta("\n\n")
	}
	return strings.TrimSpace(final), nil
}

// PlanJSON meminta CEO memecah perintah menjadi sub-tugas dalam format JSON terstruktur.
func (l *LLM) PlanJSON(ctx context.Context, system, user string, workerIDs []string) (*Plan, error) {
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"pembuka": map[string]any{"type": "string"},
			"subtasks": map[string]any{
				"type": "array",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"agent":     map[string]any{"type": "string", "enum": workerIDs},
						"judul":     map[string]any{"type": "string"},
						"instruksi": map[string]any{"type": "string"},
					},
					"required":             []string{"agent", "judul", "instruksi"},
					"additionalProperties": false,
				},
			},
		},
		"required":             []string{"pembuka", "subtasks"},
		"additionalProperties": false,
	}
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(l.model),
		MaxTokens: 16000,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(user))},
	}
	resp, err := l.client.Messages.New(ctx, params, l.requestOptions(
		option.WithJSONSet("output_config.format", map[string]any{"type": "json_schema", "schema": schema}),
	)...)
	if err != nil {
		return nil, describeErr(err)
	}
	if resp.StopReason == anthropic.StopReasonRefusal {
		return nil, errors.New("permintaan ditolak oleh model (refusal)")
	}
	var text strings.Builder
	for _, b := range resp.Content {
		if t, ok := b.AsAny().(anthropic.TextBlock); ok {
			text.WriteString(t.Text)
		}
	}
	var p Plan
	if err := json.Unmarshal([]byte(text.String()), &p); err != nil {
		return nil, fmt.Errorf("rencana CEO bukan JSON valid: %w", err)
	}
	return &p, nil
}

func describeErr(err error) error {
	var apierr *anthropic.Error
	if errors.As(err, &apierr) {
		switch apierr.StatusCode {
		case 401:
			return errors.New("API key tidak valid (401)")
		case 429:
			return errors.New("terkena rate limit (429), coba lagi sebentar")
		case 400:
			return fmt.Errorf("permintaan ditolak API (400): %s", apierr.Error())
		default:
			return fmt.Errorf("error API (%d): %s", apierr.StatusCode, apierr.Error())
		}
	}
	return err
}
