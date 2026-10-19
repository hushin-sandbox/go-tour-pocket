/**
 * スパイクで使う実行プリセット。Tour の該当ページのコードをもとにして、
 * `//go:build OMIT` などのビルドタグだけ外したもの。
 */

export interface GoPreset {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const goPresets: GoPreset[] = [
  {
    id: 'hello',
    label: 'Hello, 世界',
    description: 'fmt.Println が動くか',
    code: `package main

import "fmt"

func main() {
	fmt.Println("Hello, 世界")
}
`,
  },
  {
    id: 'select',
    label: 'select（Tour）',
    description: 'goroutine / channel / select（concurrency/select.go）',
    code: `package main

import "fmt"

func fibonacci(c, quit chan int) {
	x, y := 0, 1
	for {
		select {
		case c <- x:
			x, y = y, x+y
		case <-quit:
			fmt.Println("quit")
			return
		}
	}
}

func main() {
	c := make(chan int)
	quit := make(chan int)
	go func() {
		for i := 0; i < 10; i++ {
			fmt.Println(<-c)
		}
		quit <- 0
	}()
	fibonacci(c, quit)
}
`,
  },
  {
    id: 'image',
    label: '画像（Tour）',
    description: 'pic.ShowImage で画像が出るか（methods/exercise-images.go の解答）',
    code: `package main

import (
	"image"
	"image/color"

	"golang.org/x/tour/pic"
)

type Image struct {
	Height, Width int
}

func (m Image) ColorModel() color.Model {
	return color.RGBAModel
}

func (m Image) Bounds() image.Rectangle {
	return image.Rect(0, 0, m.Height, m.Width)
}

func (m Image) At(x, y int) color.Color {
	c := uint8(x ^ y)
	return color.RGBA{c, c, 255, 255}
}

func main() {
	m := Image{256, 256}
	pic.ShowImage(m)
}
`,
  },
  {
    id: 'infinite',
    label: '無限ループ',
    description: '停止ボタンとタイムアウトが効くか',
    code: `package main

import (
	"fmt"
	"time"
)

func main() {
	for i := 0; ; i++ {
		fmt.Println("running", i)
		time.Sleep(500 * time.Millisecond)
	}
}
`,
  },
];

export const defaultPreset = goPresets[0];
