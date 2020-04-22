// camel-k: language=java

import org.apache.camel.builder.RouteBuilder;

public class HelloWorld extends RouteBuilder {
  @Override
  public void configure() throws Exception {

      // Write your routes here, for example:
      from("timer:java?period=1s")
        .routeId("java")
        .setBody()
          .simple("Hello Camel K from ${routeId}")
        .to("log:info");
  }
}
